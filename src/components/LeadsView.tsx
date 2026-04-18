import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Download, Users, Mail, Phone, Calendar, Filter, Search, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VirtualList } from '@/components/ui/virtual-list';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/lib/workspace';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import CampaignLeadsRanking from './CampaignLeadsRanking';

interface MetaLead {
  id: string;
  lead_id: string;
  form_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  created_time: string;
  field_data: Record<string, string>;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  is_organic: boolean;
  platform: string;
  synced_at: string;
}

interface CampaignMap {
  [id: string]: string;
}

export default function LeadsView() {
  const { workspace } = useWorkspace();
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignMap>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const fetchLeads = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('meta_leads')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_time', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLeads((data || []) as unknown as MetaLead[]);

      // Fetch campaign names
      const { data: camps } = await supabase
        .from('meta_campaigns')
        .select('campaign_id, name')
        .eq('workspace_id', workspace.id);

      if (camps) {
        const map: CampaignMap = {};
        for (const c of camps) { map[c.campaign_id] = c.name; }
        setCampaigns(map);
      }
    } catch (err: any) {
      toast.error(`Erro ao carregar leads: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();

    // Realtime subscription
    if (!workspace?.id) return;
    const channel = supabase
      .channel('meta_leads_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'meta_leads',
        filter: `workspace_id=eq.${workspace.id}`,
      }, (payload) => {
        setLeads(prev => [payload.new as unknown as MetaLead, ...prev]);
        toast.info('🔔 Novo lead recebido!', { duration: 5000 });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspace?.id]);

  const handleSync = async () => {
    if (!workspace?.id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-meta-leads', {
        body: { workspace_id: workspace.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');
      toast.success(data.message || `${data.leads_synced} leads sincronizados`);
      await fetchLeads();
    } catch (err: any) {
      toast.error(`Erro no sync: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const uniqueCampaigns = useMemo(() => {
    const ids = new Set(leads.map(l => l.campaign_id).filter(Boolean) as string[]);
    return Array.from(ids);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.lead_name?.toLowerCase().includes(q) ||
        l.lead_email?.toLowerCase().includes(q) ||
        l.lead_phone?.includes(q) ||
        Object.values(l.field_data || {}).some(v => v.toLowerCase().includes(q))
      );
    }

    if (campaignFilter !== 'all') {
      result = result.filter(l => l.campaign_id === campaignFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (dateFilter === '7d') cutoff.setDate(now.getDate() - 7);
      if (dateFilter === '30d') cutoff.setDate(now.getDate() - 30);
      if (dateFilter === '90d') cutoff.setDate(now.getDate() - 90);
      result = result.filter(l => new Date(l.created_time) >= cutoff);
    }

    return result;
  }, [leads, search, campaignFilter, dateFilter]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayLeads = leads.filter(l => l.created_time?.slice(0, 10) === today).length;
    const last7d = leads.filter(l => {
      const d = new Date(l.created_time);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      return d >= cutoff;
    }).length;
    const organicCount = leads.filter(l => l.is_organic).length;
    return { total: leads.length, today: todayLeads, last7d, organic: organicCount };
  }, [leads]);

  const exportCSV = () => {
    const headers = ['Data', 'Nome', 'Email', 'Telefone', 'Campanha', 'Plataforma', 'Orgânico'];
    const rows = filteredLeads.map(l => [
      new Date(l.created_time).toLocaleDateString('pt-BR'),
      l.lead_name || '',
      l.lead_email || '',
      l.lead_phone || '',
      campaigns[l.campaign_id || ''] || l.campaign_id || '',
      l.platform || '',
      l.is_organic ? 'Sim' : 'Não',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/webhook-meta-leads`;

  return (
    <div className="space-y-6">
      {/* Ranking de leads por campanha (API Meta) */}
      <CampaignLeadsRanking />

      {/* Divider */}
      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Lead Ads (formulários)</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total de Leads', value: stats.total, icon: Users, color: 'text-primary' },
          { label: 'Hoje', value: stats.today, icon: Calendar, color: 'text-positive' },
          { label: 'Últimos 7 dias', value: stats.last7d, icon: Mail, color: 'text-accent-foreground' },
          { label: 'Orgânicos', value: stats.organic, icon: Phone, color: 'text-muted-foreground' },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSync} disabled={syncing} size="sm" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sync Lead Ads'}
          </Button>
          <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2" disabled={filteredLeads.length === 0}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar leads..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 w-48 bg-surface-2/50 border-border text-xs"
              />
            </div>

            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="h-8 w-40 text-xs bg-surface-2/50 border-border">
                <SelectValue placeholder="Campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as campanhas</SelectItem>
                {uniqueCampaigns.map(id => (
                  <SelectItem key={id} value={id}>
                    {campaigns[id] || id.slice(0, 12) + '...'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-8 w-28 text-xs bg-surface-2/50 border-border">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="90d">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Webhook Info */}
      <div className="glass-card p-3 flex items-center gap-3 text-xs">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Webhook</Badge>
        <code className="text-muted-foreground font-mono text-[11px] flex-1 truncate">{webhookUrl}</code>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px]"
          onClick={() => {
            navigator.clipboard.writeText(webhookUrl);
            toast.success('URL do webhook copiada!');
          }}
        >
          Copiar
        </Button>
      </div>

      {/* Leads Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Carregando leads...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Users className="h-12 w-12 text-muted-foreground/20 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {leads.length === 0
                ? 'Nenhum lead sincronizado ainda. Clique em "Sync Lead Ads" para começar.'
                : 'Nenhum lead corresponde aos filtros.'}
            </p>
          </div>
        ) : (
          <div className="min-w-[820px]">
            {/* Header row */}
            <div className="grid grid-cols-[140px_1fr_1.2fr_130px_160px_100px_100px] items-center border-b border-border bg-surface-2/40 px-3 h-9 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              <span>Data</span>
              <span>Nome</span>
              <span>Email</span>
              <span>Telefone</span>
              <span>Campanha</span>
              <span>Plataforma</span>
              <span>Tipo</span>
            </div>
            <VirtualList
              items={filteredLeads}
              rowHeight={40}
              getKey={(lead) => lead.id}
              height={Math.min(560, Math.max(200, filteredLeads.length * 40))}
              renderRow={(lead) => (
                <div className="grid grid-cols-[140px_1fr_1.2fr_130px_160px_100px_100px] items-center border-b border-border hover:bg-surface-2/30 px-3 h-10 text-xs">
                  <span className="font-mono text-muted-foreground">
                    {new Date(lead.created_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium text-foreground truncate" title={lead.lead_name || ''}>{lead.lead_name || '—'}</span>
                  <span className="text-muted-foreground truncate" title={lead.lead_email || ''}>{lead.lead_email || '—'}</span>
                  <span className="text-muted-foreground font-mono truncate">{lead.lead_phone || '—'}</span>
                  <span className="truncate" title={campaigns[lead.campaign_id || ''] || lead.campaign_id || ''}>
                    {campaigns[lead.campaign_id || ''] || (lead.campaign_id ? lead.campaign_id.slice(0, 10) + '...' : '—')}
                  </span>
                  <span>
                    <Badge variant="outline" className="text-[10px]">{lead.platform}</Badge>
                  </span>
                  <span>
                    <Badge variant={lead.is_organic ? 'secondary' : 'default'} className="text-[10px]">
                      {lead.is_organic ? 'Orgânico' : 'Pago'}
                    </Badge>
                  </span>
                </div>
              )}
            />
            <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border">
              Total: {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
