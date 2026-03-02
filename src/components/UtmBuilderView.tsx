import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Link2, Plus, Copy, Check, Search, RotateCcw, ShieldCheck,
  AlertTriangle, XCircle, Loader2, Trash2, ExternalLink
} from 'lucide-react';

// ── Types ──

interface UtmLink {
  id: string;
  workspace_id: string;
  created_by: string | null;
  created_at: string;
  base_url: string;
  full_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string | null;
  utm_term: string | null;
  platform: string;
  objetivo: string;
  funil: string;
  pais: string;
  produto: string | null;
  mes_ano: string | null;
  conjunto: string | null;
  nome_anuncio: string | null;
  publico: string | null;
}

// ── Constants ──

const PLATFORMS = [
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'organic', label: 'Orgânico' },
];

const OBJETIVOS = ['LEADS', 'VENDAS', 'TRAFEGO', 'ENGAJAMENTO', 'APP'];
const FUNIS = ['TOFU', 'MOFU', 'BOFU'];

const BWILD_REQUIRED_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign'];
const BWILD_CAMPAIGN_REGEX = /^[A-Z]+\|[A-Z]+\|[A-Z]{2}\|.+\|\d{4}-\d{2}$/;

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

// ── Validation result type ──

interface ValidationItem {
  param: string;
  value: string | null;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

function validateBwildUrl(url: string): { items: ValidationItem[]; score: number } {
  const items: ValidationItem[] = [];
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return { items: [{ param: 'url', value: url, status: 'error', message: 'URL inválida' }], score: 0 };
  }

  const params = parsed.searchParams;
  let okCount = 0;
  const total = 5;

  // utm_source
  const source = params.get('utm_source');
  if (!source) items.push({ param: 'utm_source', value: null, status: 'error', message: 'Obrigatório. Faltando.' });
  else if (['meta', 'google', 'tiktok', 'youtube', 'organic'].includes(source)) {
    items.push({ param: 'utm_source', value: source, status: 'ok', message: 'Plataforma válida' }); okCount++;
  } else {
    items.push({ param: 'utm_source', value: source, status: 'warning', message: 'Plataforma não reconhecida no padrão bwild' });
  }

  // utm_medium
  const medium = params.get('utm_medium');
  if (!medium) items.push({ param: 'utm_medium', value: null, status: 'error', message: 'Obrigatório. Faltando.' });
  else if (medium === 'paid') { items.push({ param: 'utm_medium', value: medium, status: 'ok', message: 'Correto' }); okCount++; }
  else items.push({ param: 'utm_medium', value: medium, status: 'warning', message: 'Padrão bwild usa "paid"' });

  // utm_campaign
  const campaign = params.get('utm_campaign');
  if (!campaign) items.push({ param: 'utm_campaign', value: null, status: 'error', message: 'Obrigatório. Faltando.' });
  else if (BWILD_CAMPAIGN_REGEX.test(campaign)) {
    items.push({ param: 'utm_campaign', value: campaign, status: 'ok', message: 'Formato bwild válido: OBJETIVO|FUNIL|PAÍS|PRODUTO|MÊS' }); okCount++;
  } else {
    items.push({ param: 'utm_campaign', value: campaign, status: 'error', message: 'Fora do padrão bwild. Esperado: OBJETIVO|FUNIL|PAÍS|PRODUTO|MÊS-ANO' });
  }

  // utm_content
  const content = params.get('utm_content');
  if (!content) items.push({ param: 'utm_content', value: null, status: 'warning', message: 'Recomendado. Identifica o criativo.' });
  else { items.push({ param: 'utm_content', value: content, status: 'ok', message: 'Nome do anúncio/criativo' }); okCount++; }

  // utm_term
  const term = params.get('utm_term');
  if (!term) items.push({ param: 'utm_term', value: null, status: 'warning', message: 'Recomendado. Identifica público/palavra.' });
  else { items.push({ param: 'utm_term', value: term, status: 'ok', message: 'Público ou palavra-chave' }); okCount++; }

  return { items, score: Math.round((okCount / total) * 100) };
}

// ── Main Component ──

export default function UtmBuilderView() {
  const { workspace } = useWorkspace();

  const [links, setLinks] = useState<UtmLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form
  const [baseUrl, setBaseUrl] = useState('');
  const [platform, setPlatform] = useState('meta');
  const [objetivo, setObjetivo] = useState('LEADS');
  const [funil, setFunil] = useState('TOFU');
  const [pais, setPais] = useState('BR');
  const [produto, setProduto] = useState('');
  const [mesAno, setMesAno] = useState(getCurrentMonthKey());
  const [conjunto, setConjunto] = useState('');
  const [nomeAnuncio, setNomeAnuncio] = useState('');
  const [publico, setPublico] = useState('');

  // Validator
  const [validateUrl, setValidateUrl] = useState('');

  // ── Generated URL ──
  const generatedUrl = useMemo(() => {
    if (!baseUrl) return '';
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('utm_source', platform);
      url.searchParams.set('utm_medium', platform === 'organic' ? 'organic' : 'paid');
      const campaignParts = [objetivo, funil, pais, produto || 'PRODUTO', mesAno].join('|');
      url.searchParams.set('utm_campaign', campaignParts);
      if (nomeAnuncio) url.searchParams.set('utm_content', nomeAnuncio);
      if (publico) url.searchParams.set('utm_term', publico);
      return url.toString();
    } catch {
      return '';
    }
  }, [baseUrl, platform, objetivo, funil, pais, produto, mesAno, nomeAnuncio, publico]);

  // ── Validation result ──
  const validationResult = useMemo(() => {
    if (!validateUrl.trim()) return null;
    return validateBwildUrl(validateUrl.trim());
  }, [validateUrl]);

  // ── Load history ──
  const loadLinks = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('utm_links')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setLinks(data as any);
    setLoading(false);
  }, [workspace]);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  // ── Save ──
  const saveUtm = async () => {
    if (!workspace || !generatedUrl) return;
    const { data: { user } } = await supabase.auth.getUser();
    const campaignParts = [objetivo, funil, pais, produto || 'PRODUTO', mesAno].join('|');
    const { error } = await supabase.from('utm_links').insert({
      workspace_id: workspace.id,
      created_by: user?.id || null,
      base_url: baseUrl,
      full_url: generatedUrl,
      utm_source: platform,
      utm_medium: platform === 'organic' ? 'organic' : 'paid',
      utm_campaign: campaignParts,
      utm_content: nomeAnuncio || null,
      utm_term: publico || null,
      platform,
      objetivo,
      funil,
      pais,
      produto: produto || null,
      mes_ano: mesAno,
      conjunto: conjunto || null,
      nome_anuncio: nomeAnuncio || null,
      publico: publico || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('UTM salva no histórico!');
    loadLinks();
  };

  // ── Copy ──
  const copyUrl = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Reuse ──
  const reuseLink = (link: UtmLink) => {
    setBaseUrl(link.base_url);
    setPlatform(link.platform);
    setObjetivo(link.objetivo);
    setFunil(link.funil);
    setPais(link.pais);
    setProduto(link.produto || '');
    setMesAno(link.mes_ano || getCurrentMonthKey());
    setConjunto(link.conjunto || '');
    setNomeAnuncio(link.nome_anuncio || '');
    setPublico(link.publico || '');
    toast.info('Formulário preenchido com UTM selecionada');
  };

  // ── Delete ──
  const deleteLink = async (id: string) => {
    await supabase.from('utm_links').delete().eq('id', id);
    loadLinks();
  };

  // ── Filtered links ──
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return links;
    const q = searchQuery.toLowerCase();
    return links.filter(l =>
      l.full_url.toLowerCase().includes(q) ||
      l.utm_campaign.toLowerCase().includes(q) ||
      (l.nome_anuncio || '').toLowerCase().includes(q) ||
      (l.publico || '').toLowerCase().includes(q) ||
      l.platform.toLowerCase().includes(q)
    );
  }, [links, searchQuery]);

  const urlValid = baseUrl ? isValidUrl(baseUrl) : true;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          UTM Builder
          <Badge variant="secondary" className="text-[10px]">Padrão bwild</Badge>
        </h2>
      </div>

      <Tabs defaultValue="builder" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="builder" className="text-xs gap-1"><Plus className="h-3.5 w-3.5" /> Gerar UTM</TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1"><Search className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
          <TabsTrigger value="validator" className="text-xs gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Validador</TabsTrigger>
        </TabsList>

        {/* ═══ BUILDER ═══ */}
        <TabsContent value="builder" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Gerar URL com UTMs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* URL */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">URL Final da Landing Page</label>
                <Input
                  className={`h-9 text-sm ${!urlValid ? 'border-destructive' : ''}`}
                  placeholder="https://site.com/lp"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                />
                {!urlValid && <p className="text-[10px] text-destructive mt-0.5">URL inválida</p>}
              </div>

              {/* Row 1: Platform, Objetivo, Funil */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Plataforma</label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Objetivo</label>
                  <Select value={objetivo} onValueChange={setObjetivo}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OBJETIVOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Funil</label>
                  <Select value={funil} onValueChange={setFunil}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FUNIS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: País, Produto, Mês */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">País</label>
                  <Input className="h-9 text-sm" value={pais} onChange={e => setPais(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Produto/Serviço</label>
                  <Input className="h-9 text-sm" placeholder="CRM, Imóvel, etc." value={produto} onChange={e => setProduto(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês/Ano</label>
                  <Input type="month" className="h-9 text-sm" value={mesAno} onChange={e => setMesAno(e.target.value)} />
                </div>
              </div>

              {/* Row 3: Conjunto, Anúncio, Público */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Conjunto/Grupo</label>
                  <Input className="h-9 text-sm" placeholder="Broad_30-50" value={conjunto} onChange={e => setConjunto(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do Anúncio</label>
                  <Input className="h-9 text-sm" placeholder="ProvaSocial_VSL_V1" value={nomeAnuncio} onChange={e => setNomeAnuncio(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Público/Palavra-chave</label>
                  <Input className="h-9 text-sm" placeholder="Broad, Lookalike, etc." value={publico} onChange={e => setPublico(e.target.value)} />
                </div>
              </div>

              {/* Generated URL */}
              {generatedUrl && urlValid && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground block">URL Gerada</label>
                  <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 break-all">
                    <p className="text-xs text-foreground font-mono leading-relaxed">{generatedUrl}</p>
                  </div>

                  {/* UTM breakdown */}
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      try {
                        const u = new URL(generatedUrl);
                        return Array.from(u.searchParams.entries()).map(([k, v]) => (
                          <Badge key={k} variant="outline" className="text-[10px] font-mono">
                            <span className="text-primary">{k}</span>=<span className="text-foreground">{v}</span>
                          </Badge>
                        ));
                      } catch { return null; }
                    })()}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={copyUrl} className="gap-1.5">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copiada!' : 'Copiar URL'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={saveUtm} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Salvar no histórico
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ HISTORY ═══ */}
        <TabsContent value="history" className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="h-8 text-xs pl-8" placeholder="Buscar por URL, campanha, criativo, público..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <Badge variant="secondary" className="text-[10px]">{filtered.length} UTMs</Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <Card className="glass-card"><CardContent className="py-10 text-center text-muted-foreground">
              <Link2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhuma UTM gerada ainda.</p>
            </CardContent></Card>
          ) : (
            <Card className="glass-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">URL</TableHead>
                      <TableHead className="text-[10px]">Campanha</TableHead>
                      <TableHead className="text-[10px]">Criativo</TableHead>
                      <TableHead className="text-[10px]">Público</TableHead>
                      <TableHead className="text-[10px]">Plataforma</TableHead>
                      <TableHead className="text-[10px]">Data</TableHead>
                      <TableHead className="text-[10px] w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(link => (
                      <TableRow key={link.id} className="group">
                        <TableCell className="text-[10px] max-w-[200px] truncate font-mono">{link.base_url}</TableCell>
                        <TableCell className="text-[10px]">
                          <Badge variant="outline" className="text-[10px] font-mono">{link.utm_campaign}</Badge>
                        </TableCell>
                        <TableCell className="text-[10px]">{link.nome_anuncio || '—'}</TableCell>
                        <TableCell className="text-[10px]">{link.publico || '—'}</TableCell>
                        <TableCell className="text-[10px]">
                          <Badge variant="secondary" className="text-[10px]">{link.platform}</Badge>
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground">
                          {new Date(link.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => reuseLink(link)} title="Reusar">
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={async () => { await navigator.clipboard.writeText(link.full_url); toast.success('URL copiada!'); }} title="Copiar">
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteLink(link.id)} title="Excluir">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ═══ VALIDATOR ═══ */}
        <TabsContent value="validator" className="space-y-3">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Validador de UTMs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Cole uma URL para validar</label>
                <Input
                  className="h-9 text-sm font-mono"
                  placeholder="https://site.com/lp?utm_source=meta&utm_medium=paid&utm_campaign=..."
                  value={validateUrl}
                  onChange={e => setValidateUrl(e.target.value)}
                />
              </div>

              {validationResult && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {/* Score */}
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${validationResult.score >= 80 ? 'text-emerald-400' : validationResult.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                      {validationResult.score}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {validationResult.score >= 80 ? 'URL bem formatada!' : validationResult.score >= 50 ? 'Algumas melhorias necessárias' : 'Fora do padrão bwild'}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-1.5">
                    {validationResult.items.map(item => (
                      <div key={item.param} className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                        item.status === 'ok' ? 'border-emerald-500/20 bg-emerald-500/5' :
                        item.status === 'warning' ? 'border-amber-500/20 bg-amber-500/5' :
                        'border-red-500/20 bg-red-500/5'
                      }`}>
                        {item.status === 'ok' ? <Check className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" /> :
                         item.status === 'warning' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" /> :
                         <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-foreground">{item.param}</span>
                            {item.value && <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[300px]">= {item.value}</span>}
                          </div>
                          <p className={`text-[10px] mt-0.5 ${
                            item.status === 'ok' ? 'text-emerald-400/80' :
                            item.status === 'warning' ? 'text-amber-400/80' : 'text-red-400/80'
                          }`}>{item.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pattern reference */}
                  <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Padrão bwild esperado:</p>
                    <p className="text-[10px] font-mono text-foreground/70">
                      utm_source=<span className="text-primary">{'{plataforma}'}</span>&amp;
                      utm_medium=<span className="text-primary">paid</span>&amp;
                      utm_campaign=<span className="text-primary">{'{OBJETIVO}|{FUNIL}|{PAÍS}|{PRODUTO}|{MÊS-ANO}'}</span>&amp;
                      utm_content=<span className="text-primary">{'{nome_anuncio}'}</span>&amp;
                      utm_term=<span className="text-primary">{'{publico}'}</span>
                    </p>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
