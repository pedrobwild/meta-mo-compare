import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Image, MessageCircle, Heart, Eye, Bookmark, Share2, Send, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/lib/workspace';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface MediaPost {
  id: string;
  media_id: string;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  caption: string | null;
  timestamp: string | null;
  like_count: number;
  comments_count: number;
  ig_user_id: string;
}

interface MediaInsight {
  media_id: string;
  impressions: number;
  reach: number;
  engagement: number;
  saved: number;
  shares: number;
  video_views: number;
}

interface Conversation {
  id: string;
  conversation_id: string;
  participant_name: string | null;
  participant_username: string | null;
  participant_id: string | null;
  updated_time: string | null;
}

interface Message {
  id: string;
  message_id: string;
  conversation_id: string;
  sender_id: string | null;
  message_text: string | null;
  created_time: string | null;
  is_from_page: boolean;
}

export default function InstagramView() {
  const { workspace } = useWorkspace();
  const [posts, setPosts] = useState<MediaPost[]>([]);
  const [insights, setInsights] = useState<Record<string, MediaInsight>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [igUserId, setIgUserId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const [mediaRes, insightsRes, convosRes] = await Promise.all([
        supabase.from('ig_media').select('*').eq('workspace_id', workspace.id).order('timestamp', { ascending: false }).limit(100),
        supabase.from('ig_media_insights').select('*').eq('workspace_id', workspace.id),
        supabase.from('ig_conversations').select('*').eq('workspace_id', workspace.id).order('updated_time', { ascending: false }),
      ]);

      // Cast data to avoid deep type inference issues
      setPosts((mediaRes.data || []) as unknown as MediaPost[]);
      if ((mediaRes.data as any)?.[0]?.ig_user_id) {
        setIgUserId((mediaRes.data as any)[0].ig_user_id);
      }

      const insMap: Record<string, MediaInsight> = {};
      for (const i of (insightsRes.data || []) as unknown as MediaInsight[]) {
        insMap[i.media_id] = i;
      }
      setInsights(insMap);
      setConversations((convosRes.data || []) as unknown as Conversation[]);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    if (!workspace?.id) return;
    setSelectedConvo(conversationId);
    const { data } = await supabase
      .from('ig_messages')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('conversation_id', conversationId)
      .order('created_time', { ascending: true });
    setMessages((data || []) as unknown as Message[]);
  };

  useEffect(() => { fetchData(); }, [workspace?.id]);

  // Realtime for new messages
  useEffect(() => {
    if (!workspace?.id) return;
    const channel = supabase
      .channel('ig_messages_rt')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ig_messages',
        filter: `workspace_id=eq.${workspace.id}`,
      }, (payload) => {
        const msg = payload.new as unknown as Message;
        if (msg.conversation_id === selectedConvo) {
          setMessages(prev => [...prev, msg]);
        }
        if (!msg.is_from_page) {
          toast.info('📩 Nova mensagem no Instagram!');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [workspace?.id, selectedConvo]);

  const handleSync = async () => {
    if (!workspace?.id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-instagram', {
        body: { workspace_id: workspace.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      if (data.ig_user_id) setIgUserId(data.ig_user_id);
      toast.success(data.message || 'Instagram sincronizado!');
      await fetchData();
    } catch (err: any) {
      toast.error(`Erro no sync: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSendReply = async () => {
    if (!workspace?.id || !selectedConvo || !replyText.trim() || !igUserId) return;
    const convo = conversations.find(c => c.conversation_id === selectedConvo);
    if (!convo?.participant_id) {
      toast.error('Não foi possível identificar o destinatário');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-instagram', {
        body: {
          workspace_id: workspace.id,
          action: 'send_message',
          ig_user_id: igUserId,
          recipient_id: convo.participant_id,
          message: replyText.trim(),
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar');
      toast.success('Mensagem enviada!');
      setReplyText('');
      // Re-fetch messages after a short delay
      setTimeout(() => fetchMessages(selectedConvo), 1500);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const stats = useMemo(() => {
    const totalPosts = posts.length;
    const totalImpressions = Object.values(insights).reduce((s, i) => s + i.impressions, 0);
    const totalReach = Object.values(insights).reduce((s, i) => s + i.reach, 0);
    const totalEngagement = Object.values(insights).reduce((s, i) => s + i.engagement, 0);
    const avgEngRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;
    return { totalPosts, totalImpressions, totalReach, totalEngagement, avgEngRate };
  }, [posts, insights]);

  const selectedConvoMessages = messages;
  const selectedConvoInfo = conversations.find(c => c.conversation_id === selectedConvo);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Posts', value: stats.totalPosts, icon: Image, color: 'text-primary' },
          { label: 'Impressões', value: stats.totalImpressions.toLocaleString('pt-BR'), icon: Eye, color: 'text-accent-foreground' },
          { label: 'Alcance', value: stats.totalReach.toLocaleString('pt-BR'), icon: Share2, color: 'text-positive' },
          { label: 'Engajamento', value: stats.totalEngagement.toLocaleString('pt-BR'), icon: Heart, color: 'text-destructive' },
          { label: 'Taxa Eng.', value: `${stats.avgEngRate.toFixed(2)}%`, icon: Bookmark, color: 'text-muted-foreground' },
        ].map((s) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Sync Button */}
      <div className="glass-card p-4 flex items-center gap-3">
        <Button onClick={handleSync} disabled={syncing} size="sm" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sync Instagram'}
        </Button>
        {igUserId && (
          <Badge variant="outline" className="text-[10px]">IG ID: {igUserId}</Badge>
        )}
      </div>

      {/* Tabs: Posts + DMs */}
      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList className="bg-surface-2/50">
          <TabsTrigger value="posts" className="text-xs gap-1.5"><Image className="h-3.5 w-3.5" /> Posts</TabsTrigger>
          <TabsTrigger value="dms" className="text-xs gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> Mensagens</TabsTrigger>
        </TabsList>

        {/* ─── POSTS TAB ─── */}
        <TabsContent value="posts">
          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Carregando posts...</div>
            ) : posts.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <Image className="h-12 w-12 text-muted-foreground/20 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhum post sincronizado. Clique em "Sync Instagram".</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs w-12"></TableHead>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs max-w-[200px]">Legenda</TableHead>
                      <TableHead className="text-xs text-right">Impressões</TableHead>
                      <TableHead className="text-xs text-right">Alcance</TableHead>
                      <TableHead className="text-xs text-right">Eng.</TableHead>
                      <TableHead className="text-xs text-right">Salvos</TableHead>
                      <TableHead className="text-xs text-right">❤️</TableHead>
                      <TableHead className="text-xs text-right">💬</TableHead>
                      <TableHead className="text-xs w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((post) => {
                      const ins = insights[post.media_id];
                      return (
                        <TableRow key={post.id} className="border-border hover:bg-surface-2/30">
                          <TableCell>
                            {(post.thumbnail_url || post.media_url) ? (
                              <img
                                src={post.thumbnail_url || post.media_url || ''}
                                alt=""
                                className="h-8 w-8 rounded object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                <Image className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {post.timestamp ? new Date(post.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{post.media_type || '—'}</Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate" title={post.caption || ''}>
                            {post.caption?.slice(0, 60) || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-right font-mono">{ins?.impressions?.toLocaleString('pt-BR') || '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{ins?.reach?.toLocaleString('pt-BR') || '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{ins?.engagement?.toLocaleString('pt-BR') || '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{ins?.saved || '—'}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{post.like_count}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{post.comments_count}</TableCell>
                          <TableCell>
                            {post.permalink && (
                              <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── DMs TAB ─── */}
        <TabsContent value="dms">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Conversation List */}
            <div className="glass-card overflow-hidden">
              <div className="p-3 border-b border-border">
                <h3 className="text-xs font-semibold text-foreground">Conversas</h3>
              </div>
              {conversations.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">Nenhuma conversa. Sync para carregar.</div>
              ) : (
                <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                  {conversations.map((convo) => (
                    <button
                      key={convo.id}
                      onClick={() => fetchMessages(convo.conversation_id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-surface-2/40 transition-colors ${
                        selectedConvo === convo.conversation_id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <p className="text-xs font-medium text-foreground truncate">
                        {convo.participant_name || convo.participant_username || convo.participant_id || 'Usuário'}
                      </p>
                      {convo.participant_username && (
                        <p className="text-[10px] text-muted-foreground">@{convo.participant_username}</p>
                      )}
                      {convo.updated_time && (
                        <p className="text-[10px] text-muted-foreground/60">
                          {new Date(convo.updated_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="glass-card md:col-span-2 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border">
                <h3 className="text-xs font-semibold text-foreground">
                  {selectedConvoInfo
                    ? `Conversa com ${selectedConvoInfo.participant_name || selectedConvoInfo.participant_username || 'Usuário'}`
                    : 'Selecione uma conversa'}
                </h3>
              </div>

              <div className="flex-1 p-3 space-y-2 max-h-[400px] overflow-y-auto">
                {selectedConvoMessages.length === 0 && selectedConvo && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma mensagem encontrada</p>
                )}
                {!selectedConvo && (
                  <p className="text-xs text-muted-foreground text-center py-8">← Selecione uma conversa para ver as mensagens</p>
                )}
                {selectedConvoMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.is_from_page ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-xs ${
                      msg.is_from_page
                        ? 'bg-primary/15 text-foreground'
                        : 'bg-surface-2 text-foreground'
                    }`}>
                      <p>{msg.message_text || '(mídia)'}</p>
                      {msg.created_time && (
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {new Date(msg.created_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {selectedConvo && (
                <div className="p-3 border-t border-border flex gap-2">
                  <Input
                    placeholder="Escreva sua resposta..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                    className="text-xs h-8 bg-surface-2/50 border-border"
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={!replyText.trim() || sending}
                    onClick={handleSendReply}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sending ? '...' : 'Enviar'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
