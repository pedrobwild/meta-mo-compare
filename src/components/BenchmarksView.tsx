import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspace } from '@/lib/workspace';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Gauge, Settings2, TrendingUp, TrendingDown, Minus,
  Loader2, Save, ArrowRight, BarChart3, Target, AlertTriangle
} from 'lucide-react';

// ── Types ──

interface Benchmark {
  id: string;
  segment: string;
  platform: string;
  metric: string;
  value_low: number;
  value_mid: number;
  value_high: number;
  unit: string;
  source: string;
}

interface WorkspaceSettings {
  id?: string;
  workspace_id: string;
  segment: string;
  ticket_medio: number;
  ciclo_vendas_dias: number;
  updated_at?: string;
}

// ── Constants ──

const SEGMENTS: Record<string, { label: string; emoji: string }> = {
  saas_b2b: { label: 'SaaS B2B', emoji: '💻' },
  ecommerce: { label: 'E-commerce', emoji: '🛒' },
  infoproduto: { label: 'Infoproduto', emoji: '📚' },
  servicos: { label: 'Serviços', emoji: '🔧' },
  educacao: { label: 'Educação', emoji: '🎓' },
  saude: { label: 'Saúde', emoji: '🏥' },
  imobiliario: { label: 'Imobiliário', emoji: '🏠' },
  agencia: { label: 'Agência', emoji: '📊' },
};

const METRIC_LABELS: Record<string, { label: string; description: string }> = {
  ctr_feed: { label: 'CTR (Feed)', description: 'Taxa de cliques no feed' },
  ctr_advantage_plus: { label: 'CTR Advantage+', description: 'CTR com audiência Advantage+' },
  thruplay_rate: { label: 'ThruPlay Rate', description: 'Taxa de visualização completa (vídeos)' },
  cpm: { label: 'CPM', description: 'Custo por mil impressões' },
  roas: { label: 'ROAS', description: 'Retorno sobre investimento' },
  cpl: { label: 'CPL', description: 'Custo por lead' },
  cpa: { label: 'CPA', description: 'Custo por aquisição' },
  frequency_7d: { label: 'Frequência (7d)', description: 'Frequência em janela de 7 dias' },
  partnership_cpa_discount: { label: 'Partnership CPA ↓', description: 'Desconto CPA em Partnership Ads' },
  partnership_ctr_lift: { label: 'Partnership CTR ↑', description: 'Aumento CTR em Partnership Ads' },
};

function formatValue(val: number, unit: string): string {
  if (unit === 'percent') return `${val.toFixed(1)}%`;
  if (unit === 'brl') return `R$ ${val.toFixed(2)}`;
  if (unit === 'multiplier') return `${val.toFixed(1)}x`;
  return val.toFixed(1);
}

// For cost metrics, lower = better; invert the logic
const LOWER_IS_BETTER = ['cpm', 'cpl', 'cpa', 'frequency_7d'];

function getPosition(value: number, low: number, mid: number, high: number, metric: string): { pct: number; status: 'low' | 'mid' | 'high' } {
  const inverted = LOWER_IS_BETTER.includes(metric);
  if (inverted) {
    // For cost metrics: below low = excellent, above high = bad
    if (value <= low) return { pct: 90, status: 'high' };
    if (value >= high) return { pct: 10, status: 'low' };
    if (value <= mid) {
      const pct = 60 + ((mid - value) / (mid - low)) * 30;
      return { pct, status: 'mid' };
    }
    const pct = 10 + ((high - value) / (high - mid)) * 50;
    return { pct, status: 'low' };
  } else {
    if (value >= high) return { pct: 90, status: 'high' };
    if (value <= low) return { pct: 10, status: 'low' };
    if (value >= mid) {
      const pct = 60 + ((value - mid) / (high - mid)) * 30;
      return { pct, status: 'high' };
    }
    const pct = 10 + ((value - low) / (mid - low)) * 50;
    return { pct, status: 'mid' };
  }
}

// ── Main Component ──

export default function BenchmarksView() {
  const { workspace } = useWorkspace();
  const { current } = useFilteredRecords();

  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings form
  const [formSegment, setFormSegment] = useState('servicos');
  const [formTicket, setFormTicket] = useState(0);
  const [formCiclo, setFormCiclo] = useState(30);

  // Load data
  const loadData = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);

    const [benchRes, settingsRes] = await Promise.all([
      supabase.from('benchmarks').select('*').order('metric'),
      supabase.from('workspace_settings').select('*').eq('workspace_id', workspace.id).maybeSingle(),
    ]);

    if (benchRes.data) setBenchmarks(benchRes.data as any);
    if (settingsRes.data) {
      const s = settingsRes.data as any;
      setSettings(s);
      setFormSegment(s.segment);
      setFormTicket(s.ticket_medio || 0);
      setFormCiclo(s.ciclo_vendas_dias || 30);
    }
    setLoading(false);
  }, [workspace]);

  useEffect(() => { loadData(); }, [loadData]);

  // Save settings
  const saveSettings = async () => {
    if (!workspace) return;
    setSaving(true);
    if (settings?.id) {
      await supabase.from('workspace_settings').update({
        segment: formSegment,
        ticket_medio: formTicket,
        ciclo_vendas_dias: formCiclo,
        updated_at: new Date().toISOString(),
      } as any).eq('id', settings.id);
    } else {
      await supabase.from('workspace_settings').insert({
        workspace_id: workspace.id,
        segment: formSegment,
        ticket_medio: formTicket,
        ciclo_vendas_dias: formCiclo,
      } as any);
    }
    toast.success('Configurações salvas!');
    setSaving(false);
    loadData();
  };

  // Current segment
  const segment = settings?.segment || formSegment;
  const segCfg = SEGMENTS[segment] || { label: segment, emoji: '📊' };

  // Filter benchmarks for current segment
  const segBenchmarks = useMemo(() =>
    benchmarks.filter(b => b.segment === segment && b.platform === 'meta'),
  [benchmarks, segment]);

  // Compute account KPIs from records
  const accountKpis = useMemo(() => {
    if (current.length === 0) return {} as Record<string, number>;
    const totals = current.reduce((acc, r) => {
      acc.spend += r.spend_brl || 0;
      acc.impressions += r.impressions || 0;
      acc.clicks += r.link_clicks || 0;
      acc.results += r.results || 0;
      acc.reach += r.reach || 0;
      return acc;
    }, { spend: 0, impressions: 0, clicks: 0, results: 0, reach: 0 });

    const kpis: Record<string, number> = {};
    if (totals.impressions > 0) {
      kpis.ctr_feed = (totals.clicks / totals.impressions) * 100;
      kpis.cpm = (totals.spend / totals.impressions) * 1000;
    }
    if (totals.results > 0) {
      kpis.cpl = totals.spend / totals.results;
      kpis.cpa = totals.spend / totals.results;
    }
    if (totals.spend > 0 && totals.results > 0) {
      kpis.roas = totals.spend > 0 ? totals.results / totals.spend : 0;
    }
    if (totals.reach > 0 && totals.impressions > 0) {
      kpis.frequency_7d = totals.impressions / totals.reach;
    }
    return kpis;
  }, [current]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Benchmarks
          <Badge variant="secondary" className="text-[10px]">{segCfg.emoji} {segCfg.label}</Badge>
          <Badge variant="outline" className="text-[10px]">Meta Ads 2026</Badge>
        </h2>
      </div>

      <Tabs defaultValue="panel" className="space-y-3">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="panel" className="text-xs gap-1"><BarChart3 className="h-3.5 w-3.5" /> Painel</TabsTrigger>
          <TabsTrigger value="config" className="text-xs gap-1"><Settings2 className="h-3.5 w-3.5" /> Configuração</TabsTrigger>
        </TabsList>

        {/* ═══ PANEL ═══ */}
        <TabsContent value="panel" className="space-y-3">
          {segBenchmarks.length === 0 ? (
            <Card className="glass-card"><CardContent className="py-10 text-center text-muted-foreground">
              <Gauge className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum benchmark encontrado para este segmento.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {segBenchmarks.map(bench => {
                const meta = METRIC_LABELS[bench.metric] || { label: bench.metric, description: '' };
                const accountVal = accountKpis[bench.metric];
                const hasAccount = accountVal != null && !isNaN(accountVal);
                const pos = hasAccount ? getPosition(accountVal, bench.value_low, bench.value_mid, bench.value_high, bench.metric) : null;

                return (
                  <motion.div key={bench.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="glass-card group">
                      <CardContent className="p-4 space-y-3">
                        {/* Title */}
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{meta.label}</p>
                            <p className="text-[10px] text-muted-foreground">{meta.description} — {segCfg.label}</p>
                          </div>
                          {hasAccount && pos && (
                            <Badge variant="outline" className={`text-[10px] ${
                              pos.status === 'high' ? 'text-emerald-400 border-emerald-500/30' :
                              pos.status === 'mid' ? 'text-amber-400 border-amber-500/30' :
                              'text-red-400 border-red-500/30'
                            }`}>
                              {pos.status === 'high' ? <TrendingUp className="h-3 w-3 mr-0.5" /> :
                               pos.status === 'mid' ? <Minus className="h-3 w-3 mr-0.5" /> :
                               <TrendingDown className="h-3 w-3 mr-0.5" />}
                              {pos.status === 'high' ? 'Acima' : pos.status === 'mid' ? 'Na média' : 'Abaixo'}
                            </Badge>
                          )}
                        </div>

                        {/* Visual bar */}
                        <div className="relative">
                          <div className="h-2 rounded-full bg-secondary/30 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-red-500/60 via-amber-500/60 to-emerald-500/60" style={{ width: '100%' }} />
                          </div>

                          {/* Account position marker */}
                          {hasAccount && pos && (
                            <div
                              className="absolute top-[-4px] w-0 h-0"
                              style={{ left: `${Math.min(95, Math.max(5, pos.pct))}%` }}
                            >
                              <div className="relative -left-1.5">
                                <div className={`w-3 h-3 rounded-full border-2 ${
                                  pos.status === 'high' ? 'bg-emerald-400 border-emerald-300' :
                                  pos.status === 'mid' ? 'bg-amber-400 border-amber-300' :
                                  'bg-red-400 border-red-300'
                                }`} />
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                  <span className="text-[9px] font-bold text-foreground bg-background/80 px-1 rounded">
                                    {formatValue(accountVal, bench.unit)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Scale labels */}
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="text-center">
                            <p className="text-red-400 font-medium">Baixo</p>
                            <p className="text-muted-foreground">{LOWER_IS_BETTER.includes(bench.metric) ? '>' : '<'} {formatValue(bench.value_low, bench.unit)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-amber-400 font-medium">Médio</p>
                            <p className="text-muted-foreground">{formatValue(bench.value_mid, bench.unit)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-emerald-400 font-medium">Alto</p>
                            <p className="text-muted-foreground">{LOWER_IS_BETTER.includes(bench.metric) ? '<' : '>'} {formatValue(bench.value_high, bench.unit)}</p>
                          </div>
                        </div>

                        {/* Account value comparison */}
                        {hasAccount && (
                          <div className="flex items-center gap-2 pt-1 border-t border-border/20">
                            <Target className="h-3 w-3 text-primary flex-shrink-0" />
                            <span className="text-[10px] text-muted-foreground">
                              Sua conta: <span className="text-foreground font-semibold">{formatValue(accountVal, bench.unit)}</span>
                              {' '}<ArrowRight className="h-2.5 w-2.5 inline" />{' '}
                              Benchmark médio: <span className="text-foreground font-semibold">{formatValue(bench.value_mid, bench.unit)}</span>
                            </span>
                          </div>
                        )}

                        {!hasAccount && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                            <AlertTriangle className="h-3 w-3" />
                            Sincronize dados para comparar
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Summary */}
          {Object.keys(accountKpis).length > 0 && segBenchmarks.length > 0 && (
            <Card className="glass-card border-primary/20">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  Resumo — {segCfg.emoji} {segCfg.label}
                </p>
                <div className="flex flex-wrap gap-3 text-[10px]">
                  {segBenchmarks.map(bench => {
                    const val = accountKpis[bench.metric];
                    if (val == null) return null;
                    const pos = getPosition(val, bench.value_low, bench.value_mid, bench.value_high, bench.metric);
                    const meta = METRIC_LABELS[bench.metric];
                    return (
                      <span key={bench.id} className={`inline-flex items-center gap-1 ${
                        pos.status === 'high' ? 'text-emerald-400' :
                        pos.status === 'mid' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {pos.status === 'high' ? '✅' : pos.status === 'mid' ? '⚠️' : '❌'}
                        {meta?.label || bench.metric}: {formatValue(val, bench.unit)}
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ CONFIG ═══ */}
        <TabsContent value="config" className="space-y-3">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                Configuração do Segmento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Segmento de mercado</label>
                <Select value={formSegment} onValueChange={setFormSegment}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEGMENTS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Ticket Médio (R$)</label>
                  <Input type="number" className="h-9 text-sm" value={formTicket} onChange={e => setFormTicket(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Ciclo de Vendas (dias)</label>
                  <Input type="number" className="h-9 text-sm" value={formCiclo} onChange={e => setFormCiclo(parseInt(e.target.value) || 30)} />
                </div>
              </div>

              <Button onClick={saveSettings} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar configurações
              </Button>

              {settings && (
                <p className="text-[10px] text-muted-foreground">
                  Último update: {new Date(settings.updated_at || '').toLocaleDateString('pt-BR')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Reference table */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Referências Meta Ads 2026</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/30 space-y-1.5 text-[10px]">
                <p className="font-medium text-foreground">📌 Partnership Ads (novo 2026)</p>
                <p className="text-muted-foreground">CPA: ~19% menor que anúncios tradicionais</p>
                <p className="text-muted-foreground">CTR: ~13% maior que anúncios tradicionais</p>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/30 space-y-1.5 text-[10px]">
                <p className="font-medium text-foreground">📌 Advantage+ Audience</p>
                <p className="text-muted-foreground">CTR 20-30% maior que segmentação manual</p>
                <p className="text-muted-foreground">Recomendado para campanhas de escala</p>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/30 space-y-1.5 text-[10px]">
                <p className="font-medium text-foreground">📌 ThruPlay (métrica obrigatória 2026)</p>
                <p className="text-muted-foreground">Substitui Video Views em relatórios Meta</p>
                <p className="text-muted-foreground">Referência: 20-35% para criativos saudáveis</p>
              </div>
              <div className="p-2.5 rounded-lg bg-secondary/20 border border-border/30 space-y-1.5 text-[10px]">
                <p className="font-medium text-foreground">📌 Frequência (Prospecting 7d)</p>
                <p className="text-muted-foreground">Saudável: ≤ 2.5 | Atenção: 2.5-3.5 | Crítico: &gt; 3.5</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
