import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useWorkspace } from '@/lib/workspace';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, Plus, Play, CheckCircle, XCircle, AlertTriangle,
  Loader2, Bot, Search, Filter, X, Calendar, Tag, BookOpen,
  ArrowRight, TrendingUp, TrendingDown, Pause, BarChart3, Lightbulb
} from 'lucide-react';

// ── Types ──

interface Experiment {
  id: string;
  workspace_id: string;
  name: string;
  hypothesis: string;
  variable_tested: string;
  platform: string;
  campaign_id: string | null;
  control_ad_id: string | null;
  variation_ad_id: string | null;
  control_description: string;
  variation_description: string;
  primary_metric: string;
  success_threshold: number;
  secondary_metrics: string[];
  min_sample_spend: number;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  result_control: Record<string, number>;
  result_variation: Record<string, number>;
  winner: string | null;
  delta_pct: number | null;
  decision: string | null;
  learning: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Constants ──

const VARIABLE_OPTIONS: Record<string, { label: string; emoji: string }> = {
  criativo: { label: 'Criativo', emoji: '🎨' },
  publico: { label: 'Público', emoji: '👥' },
  lp: { label: 'Landing Page', emoji: '🌐' },
  oferta: { label: 'Oferta', emoji: '💰' },
  copy: { label: 'Copy', emoji: '✍️' },
  cta: { label: 'CTA', emoji: '🔘' },
  orcamento: { label: 'Orçamento', emoji: '📊' },
  lance: { label: 'Lance', emoji: '⚡' },
};

const METRIC_OPTIONS: Record<string, string> = {
  cpl: 'CPL', roas: 'ROAS', ctr: 'CTR', cvr: 'CVR', cpa: 'CPA',
  cpm: 'CPM', frequency: 'Frequência', mql_rate: '% MQL', sql_rate: '% SQL',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  planned: { label: 'Planejado', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: <Calendar className="h-3.5 w-3.5" /> },
  running: { label: 'Rodando', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <Play className="h-3.5 w-3.5" /> },
  concluded: { label: 'Concluído', color: 'bg-primary/20 text-primary border-primary/30', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Cancelado', color: 'bg-muted text-muted-foreground border-border', icon: <XCircle className="h-3.5 w-3.5" /> },
};

const WINNER_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  variation: { label: 'Variação venceu', emoji: '✅', color: 'text-emerald-400' },
  control: { label: 'Controle mantido', emoji: '❌', color: 'text-red-400' },
  inconclusive: { label: 'Inconclusivo', emoji: '⚠️', color: 'text-amber-400' },
};

// ── Helpers ──

function formatMetricValue(key: string, val: number): string {
  if (['roas'].includes(key)) return `${val.toFixed(2)}x`;
  if (['ctr', 'cvr', 'mql_rate', 'sql_rate'].includes(key)) return `${val.toFixed(2)}%`;
  if (['cpl', 'cpa', 'cpm', 'spend'].includes(key)) return `R$ ${val.toFixed(2)}`;
  return val.toFixed(1);
}

function generateExperimentName(platform: string, variable: string, version: number): string {
  const plat = platform.charAt(0).toUpperCase() + platform.slice(1);
  const varLabel = VARIABLE_OPTIONS[variable]?.label || variable;
  return `${plat}_${varLabel}_V${version}`;
}

// ── Main Component ──

export default function ExperimentsView() {
  const { workspace } = useWorkspace();
  const { current } = useFilteredRecords();

  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showConcludeModal, setShowConcludeModal] = useState<Experiment | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisForId, setAnalysisForId] = useState<string | null>(null);

  // Filters
  const [filterVar, setFilterVar] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterWinner, setFilterWinner] = useState('all');

  // New experiment form
  const [form, setForm] = useState({
    name: '', hypothesis: '', variable_tested: 'criativo', platform: 'meta',
    campaign_id: '', control_ad_id: '', variation_ad_id: '',
    control_description: '', variation_description: '',
    primary_metric: 'cpl', success_threshold: -20,
    secondary_metrics: ['mql_rate'] as string[],
    min_sample_spend: 0, started_at: new Date().toISOString().slice(0, 10),
  });

  // Conclude form
  const [concludeForm, setConcludeForm] = useState({
    result_control: {} as Record<string, number>,
    result_variation: {} as Record<string, number>,
    winner: 'inconclusive',
    decision: 'retestar',
    learning: '',
  });

  // ── Data loading ──
  const loadExperiments = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) {
      setExperiments(data.map((d: any) => ({
        ...d,
        result_control: d.result_control || {},
        result_variation: d.result_variation || {},
        secondary_metrics: d.secondary_metrics || [],
      })));
    }
    setLoading(false);
  }, [workspace]);

  useEffect(() => { loadExperiments(); }, [loadExperiments]);

  // Auto-generate name when variable/platform changes
  useEffect(() => {
    const count = experiments.filter(e => e.variable_tested === form.variable_tested && e.platform === form.platform).length;
    setForm(prev => ({ ...prev, name: generateExperimentName(prev.platform, prev.variable_tested, count + 1) }));
  }, [form.variable_tested, form.platform, experiments.length]);

  // ── CRUD ──
  const saveExperiment = async () => {
    if (!workspace) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('experiments').insert({
      workspace_id: workspace.id,
      created_by: user?.id || null,
      name: form.name,
      hypothesis: form.hypothesis,
      variable_tested: form.variable_tested,
      platform: form.platform,
      campaign_id: form.campaign_id || null,
      control_ad_id: form.control_ad_id || null,
      variation_ad_id: form.variation_ad_id || null,
      control_description: form.control_description,
      variation_description: form.variation_description,
      primary_metric: form.primary_metric,
      success_threshold: form.success_threshold,
      secondary_metrics: form.secondary_metrics,
      min_sample_spend: form.min_sample_spend,
      started_at: form.started_at,
      status: 'planned',
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success('Experimento criado!');
    setShowNewModal(false);
    loadExperiments();
  };

  const startExperiment = async (id: string) => {
    await supabase.from('experiments').update({ status: 'running', started_at: new Date().toISOString().slice(0, 10) } as any).eq('id', id);
    toast.success('Experimento iniciado!');
    loadExperiments();
  };

  const concludeExperiment = async () => {
    if (!showConcludeModal) return;
    const deltaPct = (() => {
      const metric = showConcludeModal.primary_metric;
      const ctrl = concludeForm.result_control[metric];
      const vari = concludeForm.result_variation[metric];
      if (!ctrl || ctrl === 0) return 0;
      return ((vari - ctrl) / Math.abs(ctrl)) * 100;
    })();

    const { error } = await supabase.from('experiments').update({
      status: 'concluded',
      ended_at: new Date().toISOString().slice(0, 10),
      result_control: concludeForm.result_control,
      result_variation: concludeForm.result_variation,
      winner: concludeForm.winner,
      delta_pct: Math.round(deltaPct * 100) / 100,
      decision: concludeForm.decision,
      learning: concludeForm.learning,
    } as any).eq('id', showConcludeModal.id);

    if (error) { toast.error(error.message); return; }
    toast.success('Experimento concluído!');
    setShowConcludeModal(null);
    loadExperiments();
  };

  const cancelExperiment = async (id: string) => {
    await supabase.from('experiments').update({ status: 'cancelled', ended_at: new Date().toISOString().slice(0, 10) } as any).eq('id', id);
    toast.success('Experimento cancelado');
    loadExperiments();
  };

  const deleteExperiment = async (id: string) => {
    await supabase.from('experiments').delete().eq('id', id);
    toast.success('Experimento removido');
    loadExperiments();
  };

  // ── Claude Analysis ──
  const analyzeExperiment = async (exp: Experiment) => {
    setAnalyzing(true);
    setAnalysisForId(exp.id);
    try {
      const secondaryComparison: Record<string, any> = {};
      (exp.secondary_metrics || []).forEach(m => {
        secondaryComparison[m] = {
          control: exp.result_control?.[m] ?? 'N/A',
          variation: exp.result_variation?.[m] ?? 'N/A',
        };
      });

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `Analise os resultados deste experimento A/B da bwild e dê uma recomendação de decisão.

EXPERIMENTO: ${exp.name}
HIPÓTESE: ${exp.hypothesis}
VARIÁVEL TESTADA: ${exp.variable_tested}
PERÍODO: ${exp.started_at} a ${exp.ended_at}
AMOSTRA MÍNIMA DEFINIDA: R$ ${exp.min_sample_spend} por variação

CONTROLE (${exp.control_description}):
${JSON.stringify(exp.result_control, null, 2)}

VARIAÇÃO (${exp.variation_description}):
${JSON.stringify(exp.result_variation, null, 2)}

DELTA NA MÉTRICA PRIMÁRIA (${exp.primary_metric}): ${exp.delta_pct}%

MÉTRICAS SECUNDÁRIAS:
${JSON.stringify(secondaryComparison, null, 2)}

REFERÊNCIA INTERNA BWILD:
- Critério de vitória: CPL -20% sem queda em %MQL/%SQL
- Amostra mínima: ≥ 1-1.5× CPL meta por variação
- Testar 1 variável por vez

Analise e responda:
1. A amostra foi suficiente para conclusão confiável?
2. Qual é o vencedor e por quê?
3. A hipótese foi confirmada, refutada ou inconclusiva?
4. Decisão recomendada: Escalar variação | Manter controle | Retestar
5. Aprendizado a documentar na Biblioteca (1-2 frases)
6. Próximo experimento sugerido com base neste resultado`
          }],
        },
      });
      if (error) throw error;
      const text = typeof data === 'string' ? data : data?.choices?.[0]?.message?.content || JSON.stringify(data);
      setAnalysisResult(text);
    } catch (err: any) {
      toast.error(err.message || 'Erro na análise');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Computed ──
  const active = useMemo(() => experiments.filter(e => e.status === 'running'), [experiments]);
  const planned = useMemo(() => experiments.filter(e => e.status === 'planned'), [experiments]);
  const concluded = useMemo(() => {
    return experiments.filter(e => e.status === 'concluded').filter(e => {
      if (filterVar !== 'all' && e.variable_tested !== filterVar) return false;
      if (filterPlatform !== 'all' && e.platform !== filterPlatform) return false;
      if (filterWinner !== 'all' && e.winner !== filterWinner) return false;
      return true;
    });
  }, [experiments, filterVar, filterPlatform, filterWinner]);

  const learnings = useMemo(() => {
    const withLearning = experiments.filter(e => e.status === 'concluded' && e.learning);
    const grouped: Record<string, Experiment[]> = {};
    withLearning.forEach(e => {
      const key = e.variable_tested;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });
    return grouped;
  }, [experiments]);

  // Campaign names for autocomplete
  const campaignNames = useMemo(() => {
    return [...new Set(current.filter(r => r.campaign_name).map(r => r.campaign_name!))];
  }, [current]);
  const adNames = useMemo(() => {
    return [...new Set(current.map(r => r.ad_name))];
  }, [current]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          Experimentos
          {experiments.length > 0 && <Badge variant="secondary" className="text-xs">{experiments.length}</Badge>}
        </h2>
        <Button size="sm" onClick={() => setShowNewModal(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova Hipótese
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{active.length}</p>
          <p className="text-xs text-muted-foreground">Rodando</p>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{planned.length}</p>
          <p className="text-xs text-muted-foreground">Planejados</p>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{experiments.filter(e => e.winner === 'variation').length}</p>
          <p className="text-xs text-muted-foreground">Variações vencedoras</p>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{experiments.filter(e => e.status === 'concluded').length}</p>
          <p className="text-xs text-muted-foreground">Concluídos</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="active" className="space-y-3">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="active" className="text-xs gap-1"><Play className="h-3.5 w-3.5" /> Ativos</TabsTrigger>
          <TabsTrigger value="planned" className="text-xs gap-1"><Calendar className="h-3.5 w-3.5" /> Planejados</TabsTrigger>
          <TabsTrigger value="concluded" className="text-xs gap-1"><CheckCircle className="h-3.5 w-3.5" /> Concluídos</TabsTrigger>
          <TabsTrigger value="learnings" className="text-xs gap-1"><BookOpen className="h-3.5 w-3.5" /> Aprendizados</TabsTrigger>
        </TabsList>

        {/* ═══ ACTIVE ═══ */}
        <TabsContent value="active" className="space-y-3">
          {active.length === 0 && (
            <Card className="glass-card"><CardContent className="py-10 text-center text-muted-foreground">
              <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum experimento rodando.</p>
              <p className="text-xs mt-1">Crie uma hipótese ou inicie um planejado.</p>
            </CardContent></Card>
          )}
          <AnimatePresence>
            {active.map(exp => {
              const varCfg = VARIABLE_OPTIONS[exp.variable_tested] || { label: exp.variable_tested, emoji: '🔬' };
              const daysRunning = exp.started_at ? Math.floor((Date.now() - new Date(exp.started_at).getTime()) / 86400000) : 0;
              const ctrlSpend = (exp.result_control as any)?.spend || 0;
              const varSpend = (exp.result_variation as any)?.spend || 0;
              const ctrlProg = exp.min_sample_spend > 0 ? Math.min(100, (ctrlSpend / exp.min_sample_spend) * 100) : 0;
              const varProg = exp.min_sample_spend > 0 ? Math.min(100, (varSpend / exp.min_sample_spend) * 100) : 0;

              return (
                <motion.div key={exp.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="glass-card border-emerald-500/20">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{varCfg.emoji}</span>
                            <span className="text-sm font-medium text-foreground">{exp.name}</span>
                            <Badge variant="outline" className={STATUS_CONFIG.running.color + ' text-[10px]'}>{STATUS_CONFIG.running.label}</Badge>
                            <Badge variant="outline" className="text-[10px]">{daysRunning}d</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{exp.hypothesis}</p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => {
                            setConcludeForm({
                              result_control: { ...(exp.result_control || {}), spend: ctrlSpend },
                              result_variation: { ...(exp.result_variation || {}), spend: varSpend },
                              winner: 'inconclusive', decision: 'retestar', learning: '',
                            });
                            setShowConcludeModal(exp);
                          }}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Concluir
                          </Button>
                          <Button size="sm" variant="ghost" className="text-[10px] h-7 text-destructive" onClick={() => cancelExperiment(exp.id)}>
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Sample progress */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Controle</span>
                            <span>R$ {ctrlSpend.toFixed(0)} / R$ {exp.min_sample_spend.toFixed(0)} ({ctrlProg.toFixed(0)}%)</span>
                          </div>
                          <Progress value={ctrlProg} className="h-1.5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Variação</span>
                            <span>R$ {varSpend.toFixed(0)} / R$ {exp.min_sample_spend.toFixed(0)} ({varProg.toFixed(0)}%)</span>
                          </div>
                          <Progress value={varProg} className="h-1.5" />
                        </div>
                      </div>

                      {/* Partial results */}
                      {(Object.keys(exp.result_control || {}).length > 0 || Object.keys(exp.result_variation || {}).length > 0) && (
                        <div className="text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] mb-1">⚠️ Dados parciais</Badge>
                          <div className="flex gap-4 mt-1">
                            {[exp.primary_metric, ...(exp.secondary_metrics || []).slice(0, 2)].map(m => {
                              const ctrl = (exp.result_control as any)?.[m];
                              const vari = (exp.result_variation as any)?.[m];
                              if (ctrl == null && vari == null) return null;
                              return (
                                <span key={m}>
                                  <span className="uppercase font-medium">{m}:</span>{' '}
                                  {ctrl != null ? formatMetricValue(m, ctrl) : '—'} vs {vari != null ? formatMetricValue(m, vari) : '—'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </TabsContent>

        {/* ═══ PLANNED ═══ */}
        <TabsContent value="planned" className="space-y-2">
          {planned.length === 0 && (
            <Card className="glass-card"><CardContent className="py-10 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum experimento planejado.</p>
            </CardContent></Card>
          )}
          {planned.map(exp => {
            const varCfg = VARIABLE_OPTIONS[exp.variable_tested] || { label: exp.variable_tested, emoji: '🔬' };
            return (
              <Card key={exp.id} className="glass-card group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{varCfg.emoji}</span>
                        <span className="text-sm font-medium text-foreground">{exp.name}</span>
                        <Badge variant="outline" className={STATUS_CONFIG.planned.color + ' text-[10px]'}>Planejado</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{exp.hypothesis}</p>
                      <div className="flex gap-2 text-[10px] text-muted-foreground">
                        <span>Métrica: <strong>{METRIC_OPTIONS[exp.primary_metric] || exp.primary_metric}</strong></span>
                        <span>Threshold: <strong>{exp.success_threshold}%</strong></span>
                        <span>Amostra: <strong>R$ {exp.min_sample_spend}</strong></span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => startExperiment(exp.id)}>
                        <Play className="h-3 w-3 mr-1" /> Iniciar
                      </Button>
                      <Button size="sm" variant="ghost" className="text-[10px] h-7 text-destructive" onClick={() => deleteExperiment(exp.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ═══ CONCLUDED ═══ */}
        <TabsContent value="concluded" className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={filterVar} onValueChange={setFilterVar}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Variável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(VARIABLE_OPTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPlatform} onValueChange={setFilterPlatform}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Plataforma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterWinner} onValueChange={setFilterWinner}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Resultado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="variation">✅ Variação</SelectItem>
                <SelectItem value="control">❌ Controle</SelectItem>
                <SelectItem value="inconclusive">⚠️ Inconclusivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {concluded.length === 0 && (
            <Card className="glass-card"><CardContent className="py-10 text-center text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum experimento concluído.</p>
            </CardContent></Card>
          )}

          {concluded.map(exp => {
            const varCfg = VARIABLE_OPTIONS[exp.variable_tested] || { label: exp.variable_tested, emoji: '🔬' };
            const winCfg = WINNER_CONFIG[exp.winner || 'inconclusive'];
            return (
              <Card key={exp.id} className="glass-card group">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{varCfg.emoji}</span>
                        <span className="text-sm font-medium text-foreground">{exp.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${winCfg.color}`}>{winCfg.emoji} {winCfg.label}</Badge>
                        {exp.delta_pct != null && (
                          <Badge variant="outline" className={`text-[10px] ${exp.delta_pct < 0 && ['cpl', 'cpa', 'cpm'].includes(exp.primary_metric) ? 'text-emerald-400' : exp.delta_pct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {exp.delta_pct > 0 ? '+' : ''}{exp.delta_pct.toFixed(1)}% {METRIC_OPTIONS[exp.primary_metric] || exp.primary_metric}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{exp.hypothesis}</p>
                      {exp.decision && (
                        <p className="text-xs"><span className="text-muted-foreground">Decisão:</span> <span className="text-foreground font-medium">{exp.decision.replace(/_/g, ' ')}</span></p>
                      )}
                      {exp.learning && (
                        <p className="text-xs text-foreground/70"><Lightbulb className="h-3 w-3 inline mr-1 text-amber-400" />{exp.learning}</p>
                      )}

                      {/* KPI comparison */}
                      {exp.result_control && exp.result_variation && (
                        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground mt-1">
                          {Object.keys(exp.result_control).filter(k => k !== 'spend').slice(0, 4).map(k => {
                            const ctrl = (exp.result_control as any)[k];
                            const vari = (exp.result_variation as any)[k];
                            if (ctrl == null) return null;
                            const improved = ['cpl', 'cpa', 'cpm'].includes(k) ? (vari ?? 0) < ctrl : (vari ?? 0) > ctrl;
                            return (
                              <span key={k}>
                                <span className="uppercase font-medium">{k}:</span> {formatMetricValue(k, ctrl)}
                                {vari != null && (<>
                                  {' '}<ArrowRight className="h-3 w-3 inline" />{' '}
                                  <span className={improved ? 'text-emerald-400' : 'text-red-400'}>{formatMetricValue(k, vari)}</span>
                                </>)}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button size="sm" variant="outline" className="text-[10px] h-7" disabled={analyzing && analysisForId === exp.id} onClick={() => analyzeExperiment(exp)}>
                        {analyzing && analysisForId === exp.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3 mr-1" />}
                        Analisar
                      </Button>
                    </div>
                  </div>

                  {/* Analysis result inline */}
                  {analysisResult && analysisForId === exp.id && (
                    <div className="mt-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] uppercase font-semibold text-primary flex items-center gap-1"><Bot className="h-3 w-3" /> Análise IA</p>
                        <Button size="sm" variant="ghost" className="h-5" onClick={() => { setAnalysisResult(null); setAnalysisForId(null); }}><X className="h-3 w-3" /></Button>
                      </div>
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{analysisResult}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ═══ LEARNINGS ═══ */}
        <TabsContent value="learnings" className="space-y-3">
          {Object.keys(learnings).length === 0 && (
            <Card className="glass-card"><CardContent className="py-10 text-center text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Conclua experimentos com aprendizados para preencher a biblioteca.</p>
            </CardContent></Card>
          )}

          {Object.entries(learnings).map(([varKey, exps]) => {
            const varCfg = VARIABLE_OPTIONS[varKey] || { label: varKey, emoji: '🔬' };
            return (
              <Card key={varKey} className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <span>{varCfg.emoji}</span> {varCfg.label}
                    <Badge variant="secondary" className="text-[10px]">{exps.length} experimentos</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {exps.map(exp => {
                    const winCfg = WINNER_CONFIG[exp.winner || 'inconclusive'];
                    return (
                      <div key={exp.id} className="flex items-start gap-2 p-2 rounded bg-secondary/10">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground">{exp.learning}</p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                            <span className={winCfg.color}>{winCfg.emoji}</span>
                            <span>{exp.name}</span>
                            <span>{exp.platform}</span>
                            {exp.delta_pct != null && <span>{exp.delta_pct > 0 ? '+' : ''}{exp.delta_pct.toFixed(1)}% {METRIC_OPTIONS[exp.primary_metric] || exp.primary_metric}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* ═══ MODAL: NEW EXPERIMENT ═══ */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-primary" /> Nova Hipótese</DialogTitle>
            <DialogDescription>Planeje um novo experimento A/B seguindo a metodologia bwild.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Plataforma</label>
                <Select value={form.platform} onValueChange={v => setForm(p => ({ ...p, platform: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Variável testada</label>
                <Select value={form.variable_tested} onValueChange={v => setForm(p => ({ ...p, variable_tested: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(VARIABLE_OPTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome</label>
              <Input className="h-9 text-sm" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Hipótese</label>
              <Textarea className="text-sm h-16" placeholder='Se {mudança}, então {métrica} {melhorará/cairá} {X}% mantendo {métrica_qualidade}' value={form.hypothesis} onChange={e => setForm(p => ({ ...p, hypothesis: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Controle (Descrição)</label>
                <Input className="h-9 text-sm" placeholder="Ex: Hook original" value={form.control_description} onChange={e => setForm(p => ({ ...p, control_description: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Variação (Descrição)</label>
                <Input className="h-9 text-sm" placeholder="Ex: Hook com depoimento" value={form.variation_description} onChange={e => setForm(p => ({ ...p, variation_description: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Anúncio controle</label>
                <Input className="h-9 text-sm" placeholder="Nome ou ID" value={form.control_ad_id} onChange={e => setForm(p => ({ ...p, control_ad_id: e.target.value }))} list="ad-suggestions" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Anúncio variação</label>
                <Input className="h-9 text-sm" placeholder="Nome ou ID" value={form.variation_ad_id} onChange={e => setForm(p => ({ ...p, variation_ad_id: e.target.value }))} list="ad-suggestions" />
              </div>
              <datalist id="ad-suggestions">
                {adNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Métrica primária</label>
                <Select value={form.primary_metric} onValueChange={v => setForm(p => ({ ...p, primary_metric: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METRIC_OPTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Threshold (%)</label>
                <Input type="number" className="h-9 text-sm" value={form.success_threshold} onChange={e => setForm(p => ({ ...p, success_threshold: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Amostra min (R$)</label>
                <Input type="number" className="h-9 text-sm" value={form.min_sample_spend} onChange={e => setForm(p => ({ ...p, min_sample_spend: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Métricas secundárias</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(METRIC_OPTIONS).map(([k, v]) => (
                  <button key={k} onClick={() => setForm(p => ({
                    ...p, secondary_metrics: p.secondary_metrics.includes(k) ? p.secondary_metrics.filter(m => m !== k) : [...p.secondary_metrics, k]
                  }))} className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                    form.secondary_metrics.includes(k) ? 'bg-primary/20 text-primary border-primary/40' : 'bg-secondary/30 text-muted-foreground border-border/30 hover:bg-secondary/50'
                  }`}>{v}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de início</label>
              <Input type="date" className="h-9 text-sm" value={form.started_at} onChange={e => setForm(p => ({ ...p, started_at: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewModal(false)}>Cancelar</Button>
            <Button onClick={saveExperiment} disabled={!form.name || !form.hypothesis}>Criar experimento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ MODAL: CONCLUDE ═══ */}
      <Dialog open={!!showConcludeModal} onOpenChange={open => { if (!open) setShowConcludeModal(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Concluir Experimento</DialogTitle>
            <DialogDescription>{showConcludeModal?.name}</DialogDescription>
          </DialogHeader>

          {showConcludeModal && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{showConcludeModal.hypothesis}</p>

              {/* Control results */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Resultados — Controle ({showConcludeModal.control_description})</label>
                <div className="grid grid-cols-3 gap-2">
                  {[showConcludeModal.primary_metric, ...(showConcludeModal.secondary_metrics || []), 'spend'].map(m => (
                    <div key={m}>
                      <label className="text-[10px] text-muted-foreground uppercase">{METRIC_OPTIONS[m] || m}</label>
                      <Input type="number" className="h-7 text-xs" value={concludeForm.result_control[m] ?? ''} onChange={e => setConcludeForm(p => ({ ...p, result_control: { ...p.result_control, [m]: parseFloat(e.target.value) || 0 } }))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Variation results */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Resultados — Variação ({showConcludeModal.variation_description})</label>
                <div className="grid grid-cols-3 gap-2">
                  {[showConcludeModal.primary_metric, ...(showConcludeModal.secondary_metrics || []), 'spend'].map(m => (
                    <div key={m}>
                      <label className="text-[10px] text-muted-foreground uppercase">{METRIC_OPTIONS[m] || m}</label>
                      <Input type="number" className="h-7 text-xs" value={concludeForm.result_variation[m] ?? ''} onChange={e => setConcludeForm(p => ({ ...p, result_variation: { ...p.result_variation, [m]: parseFloat(e.target.value) || 0 } }))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Winner */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Vencedor</label>
                <div className="flex gap-2">
                  {Object.entries(WINNER_CONFIG).map(([k, v]) => (
                    <button key={k} onClick={() => setConcludeForm(p => ({ ...p, winner: k }))} className={`flex-1 p-2 rounded-lg text-xs font-medium border transition-colors ${
                      concludeForm.winner === k
                        ? k === 'variation' ? 'border-emerald-500/40 bg-emerald-500/10' : k === 'control' ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/40 bg-amber-500/10'
                        : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'
                    }`}>{v.emoji} {v.label}</button>
                  ))}
                </div>
              </div>

              {/* Decision */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Decisão</label>
                <Select value={concludeForm.decision} onValueChange={v => setConcludeForm(p => ({ ...p, decision: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="escalar_variacao">🚀 Escalar variação</SelectItem>
                    <SelectItem value="manter_controle">⏸️ Manter controle</SelectItem>
                    <SelectItem value="retestar">🔄 Retestar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Learning */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Aprendizado (para a Biblioteca)</label>
                <Textarea className="text-sm h-16" placeholder="O que aprendemos com esse experimento?" value={concludeForm.learning} onChange={e => setConcludeForm(p => ({ ...p, learning: e.target.value }))} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConcludeModal(null)}>Cancelar</Button>
            <Button onClick={concludeExperiment}>Concluir experimento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
