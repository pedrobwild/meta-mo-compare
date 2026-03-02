import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspace } from '@/lib/workspace';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, aggregateMetrics, groupByLevel } from '@/lib/calculations';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, Plus, Pause, Rocket, Palette, Users, DollarSign,
  CheckCircle, XCircle, AlertTriangle, Clock, Search, Filter,
  X, Loader2, Bot, TrendingUp, TrendingDown, BarChart3,
  Calendar, Tag, User, ArrowRight, RotateCcw, Eye
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';

// ── Types ──

interface OptimizationEntry {
  id: string;
  created_at: string;
  created_by: string | null;
  workspace_id: string;
  decision_type: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  reason: string;
  action_taken: string;
  metric_before: Record<string, number>;
  metric_after: Record<string, number> | null;
  expected_impact: string;
  actual_impact: string | null;
  impact_confirmed_at: string | null;
  status: string;
  tags: string[];
  notes: string | null;
  alert_id: string | null;
  action_center_id: string | null;
}

// ── Constants ──

const DECISION_TYPES: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pausar: { label: 'Pausar', icon: <Pause className="h-4 w-4" />, color: 'text-red-400' },
  escalar: { label: 'Escalar', icon: <Rocket className="h-4 w-4" />, color: 'text-emerald-400' },
  revisar_criativo: { label: 'Revisar Criativo', icon: <Palette className="h-4 w-4" />, color: 'text-violet-400' },
  alterar_publico: { label: 'Alterar Público', icon: <Users className="h-4 w-4" />, color: 'text-blue-400' },
  alterar_orcamento: { label: 'Alterar Orçamento', icon: <DollarSign className="h-4 w-4" />, color: 'text-amber-400' },
  alterar_lance: { label: 'Alterar Lance', icon: <TrendingUp className="h-4 w-4" />, color: 'text-orange-400' },
  novo_criativo: { label: 'Novo Criativo', icon: <Plus className="h-4 w-4" />, color: 'text-pink-400' },
  novo_adset: { label: 'Novo Ad Set', icon: <Plus className="h-4 w-4" />, color: 'text-cyan-400' },
  novo_publico: { label: 'Novo Público', icon: <Plus className="h-4 w-4" />, color: 'text-indigo-400' },
  outro: { label: 'Outro', icon: <Eye className="h-4 w-4" />, color: 'text-muted-foreground' },
};

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  pending: { label: 'Pendente', emoji: '🟡', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  monitoring: { label: 'Monitorando', emoji: '🟡', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  confirmed: { label: 'Confirmada', emoji: '🟢', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  reversed: { label: 'Revertida', emoji: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const TAG_OPTIONS = ['criativo', 'escala', 'fadiga', 'público', 'orçamento', 'lance', 'LP', 'funil', 'teste', 'urgente'];

const KPI_KEYS = ['roas', 'cpa', 'ctr', 'spend', 'cpm', 'frequency', 'results', 'thruplay_rate'];

// ── Helpers ──

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}min atrás`;
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function formatKpi(key: string, value: number): string {
  if (key === 'roas') return `${value.toFixed(2)}x`;
  if (key === 'ctr' || key === 'thruplay_rate') return `${value.toFixed(2)}%`;
  if (['cpa', 'spend', 'cpm'].includes(key)) return `R$ ${value.toFixed(2)}`;
  return value.toFixed(0);
}

function kpiDelta(before: number, after: number): { text: string; positive: boolean } {
  if (!before) return { text: 'N/A', positive: false };
  const pct = ((after - before) / Math.abs(before)) * 100;
  const isGood = ['cpa', 'cpm', 'frequency'].includes('') ? pct < 0 : pct > 0;
  return { text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, positive: pct > 0 };
}

// ── Main Component ──

export default function DecisionsModule() {
  const { workspace } = useWorkspace();
  const { state } = useAppState();
  const { current } = useFilteredRecords();

  const [entries, setEntries] = useState<OptimizationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showNewDecision, setShowNewDecision] = useState(false);
  const [showConfirmImpact, setShowConfirmImpact] = useState<OptimizationEntry | null>(null);

  // Filters
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [searchText, setSearchText] = useState('');

  // Claude analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // New decision form
  const [newForm, setNewForm] = useState({
    decision_type: 'pausar',
    entity_type: 'campaign',
    entity_id: '',
    entity_name: '',
    reason: '',
    action_taken: '',
    expected_impact: '',
    tags: [] as string[],
    metric_before: {} as Record<string, number>,
  });

  // Confirm impact form
  const [confirmForm, setConfirmForm] = useState({
    metric_after: {} as Record<string, number>,
    actual_impact: '',
    evaluation: 'confirmed' as 'confirmed' | 'partial' | 'reversed',
  });

  // ── Data loading ──
  const loadEntries = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('optimization_log')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) {
      setEntries(data.map((d: any) => ({
        ...d,
        metric_before: d.metric_before || {},
        metric_after: d.metric_after || null,
        tags: d.tags || [],
      })));
    }
    setLoading(false);
  }, [workspace]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Auto-populate KPIs from current data
  const currentKpis = useMemo(() => {
    if (current.length === 0) return {};
    const agg = aggregateMetrics(current);
    return {
      spend: agg.spend_brl,
      cpa: agg.results > 0 ? agg.spend_brl / agg.results : 0,
      ctr: agg.ctr_link,
      cpm: agg.cpm,
      roas: 0,
      frequency: agg.frequency,
      results: agg.results,
    };
  }, [current]);

  // Entity search from records
  const entityOptions = useMemo(() => {
    const campaigns = [...new Set(current.filter(r => r.campaign_name).map(r => r.campaign_name!))];
    const adsets = [...new Set(current.filter(r => r.adset_name).map(r => r.adset_name!))];
    const ads = [...new Set(current.map(r => r.ad_name))];
    return { campaign: campaigns, adset: adsets, ad: ads };
  }, [current]);

  // ── CRUD ──
  const saveNewDecision = async () => {
    if (!workspace) return;
    const { data: { user } } = await supabase.auth.getUser();

    const row = {
      workspace_id: workspace.id,
      created_by: user?.id || null,
      decision_type: newForm.decision_type,
      entity_type: newForm.entity_type,
      entity_id: newForm.entity_id || newForm.entity_name.toLowerCase().replace(/\s+/g, '_'),
      entity_name: newForm.entity_name,
      reason: newForm.reason,
      action_taken: newForm.action_taken,
      expected_impact: newForm.expected_impact,
      metric_before: Object.keys(newForm.metric_before).length > 0 ? newForm.metric_before : currentKpis,
      tags: newForm.tags,
      status: 'monitoring',
    };

    const { error } = await supabase.from('optimization_log').insert(row);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
      return;
    }

    toast.success('Decisão registrada! Lembrete de confirmação em 48h.');
    setShowNewDecision(false);
    setNewForm({
      decision_type: 'pausar', entity_type: 'campaign', entity_id: '', entity_name: '',
      reason: '', action_taken: '', expected_impact: '', tags: [], metric_before: {},
    });
    loadEntries();
  };

  const confirmImpact = async () => {
    if (!showConfirmImpact) return;

    const statusMap = { confirmed: 'confirmed', partial: 'confirmed', reversed: 'reversed' };

    const { error } = await supabase.from('optimization_log').update({
      metric_after: confirmForm.metric_after,
      actual_impact: confirmForm.actual_impact,
      impact_confirmed_at: new Date().toISOString(),
      status: statusMap[confirmForm.evaluation],
    }).eq('id', showConfirmImpact.id);

    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }

    toast.success(confirmForm.evaluation === 'reversed' ? 'Decisão revertida' : 'Impacto confirmado!');
    setShowConfirmImpact(null);
    setConfirmForm({ metric_after: {}, actual_impact: '', evaluation: 'confirmed' });
    loadEntries();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('optimization_log').delete().eq('id', id);
    toast.success('Decisão removida');
    loadEntries();
  };

  // ── Claude Analysis ──
  const analyzeDecisions = async () => {
    if (!workspace) return;
    setAnalyzing(true);
    try {
      const confirmed = entries.filter(e => e.status === 'confirmed');
      const reversed = entries.filter(e => e.status === 'reversed');
      const total = entries.length;
      const successRate = total > 0 ? (confirmed.length / total * 100).toFixed(1) : '0';

      const byType: Record<string, number> = {};
      entries.forEach(e => { byType[e.decision_type] = (byType[e.decision_type] || 0) + 1; });

      const topPositive = confirmed.slice(0, 5).map(e => ({
        type: e.decision_type, entity: e.entity_name,
        before: e.metric_before, after: e.metric_after, impact: e.actual_impact
      }));
      const topNegative = reversed.slice(0, 3).map(e => ({
        type: e.decision_type, entity: e.entity_name,
        before: e.metric_before, after: e.metric_after, impact: e.actual_impact
      }));

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `Analise o histórico de decisões de otimização da bwild e identifique padrões, acertos e oportunidades de melhoria.

PERÍODO: ${state.dateFrom || 'N/A'} a ${state.dateTo || 'N/A'}
TOTAL DE DECISÕES: ${total}
TAXA DE SUCESSO GERAL: ${successRate}%

DECISÕES POR TIPO:
${JSON.stringify(byType, null, 2)}

TOP 5 DECISÕES COM MAIOR IMPACTO POSITIVO:
${JSON.stringify(topPositive, null, 2)}

TOP 3 DECISÕES QUE NÃO FUNCIONARAM:
${JSON.stringify(topNegative, null, 2)}

Analise e responda:
1. Qual tipo de decisão está gerando mais resultado?
2. Existe algum padrão nas decisões que não funcionaram?
3. O processo de otimização está seguindo a metodologia correta (pausar com ≥ 1× CPL sem conversão, escalar +20-30% a cada 48h, etc.)?
4. Quais campanhas precisam de mais atenção agora?
5. Recomendação para as próximas 48h`
          }],
        },
      });

      if (error) throw error;
      const text = typeof data === 'string' ? data : data?.choices?.[0]?.message?.content || JSON.stringify(data);
      setAnalysisResult(text);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao analisar');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Filtered & computed data ──
  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterType !== 'all' && e.decision_type !== filterType) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (filterEntity !== 'all' && e.entity_name !== filterEntity) return false;
      if (filterTag !== 'all' && !e.tags.includes(filterTag)) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!e.entity_name.toLowerCase().includes(q) && !e.reason.toLowerCase().includes(q) && !(e.notes || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [entries, filterType, filterStatus, filterEntity, filterTag, searchText]);

  const stats = useMemo(() => {
    const total = entries.length;
    const confirmed = entries.filter(e => e.status === 'confirmed').length;
    const pending = entries.filter(e => e.status === 'pending' || e.status === 'monitoring').length;
    const successRate = total > 0 ? (confirmed / total * 100) : 0;

    let savings = 0;
    entries.filter(e => e.status === 'confirmed' && e.metric_before && e.metric_after).forEach(e => {
      const cpaBefore = e.metric_before?.cpa || 0;
      const cpaAfter = e.metric_after?.cpa || 0;
      if (cpaBefore > 0 && cpaAfter > 0 && cpaAfter < cpaBefore) {
        savings += cpaBefore - cpaAfter;
      }
    });

    return { total, confirmed, pending, successRate, savings };
  }, [entries]);

  const uniqueEntities = useMemo(() => [...new Set(entries.map(e => e.entity_name))].sort(), [entries]);
  const uniqueTags = useMemo(() => [...new Set(entries.flatMap(e => e.tags))].sort(), [entries]);
  const hasFilters = filterType !== 'all' || filterStatus !== 'all' || filterEntity !== 'all' || filterTag !== 'all' || searchText !== '';

  // Patterns data
  const patternData = useMemo(() => {
    if (entries.length < 5) return null;

    const byType: Record<string, { total: number; confirmed: number; avgDays: number }> = {};
    entries.forEach(e => {
      if (!byType[e.decision_type]) byType[e.decision_type] = { total: 0, confirmed: 0, avgDays: 0 };
      byType[e.decision_type].total++;
      if (e.status === 'confirmed') byType[e.decision_type].confirmed++;
      if (e.impact_confirmed_at) {
        const days = (new Date(e.impact_confirmed_at).getTime() - new Date(e.created_at).getTime()) / 86400000;
        byType[e.decision_type].avgDays += days;
      }
    });

    const successByType = Object.entries(byType).map(([type, data]) => ({
      type: DECISION_TYPES[type]?.label || type,
      total: data.total,
      successRate: data.total > 0 ? Math.round((data.confirmed / data.total) * 100) : 0,
      avgDays: data.confirmed > 0 ? Math.round(data.avgDays / data.confirmed) : 0,
    })).sort((a, b) => b.total - a.total);

    const byDay: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    entries.forEach(e => {
      const day = new Date(e.created_at).getDay();
      byDay[day]++;
    });
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const byDayData = Object.entries(byDay).map(([d, count]) => ({ day: dayNames[Number(d)], count }));

    return { successByType, byDayData };
  }, [entries]);

  // Timeline data
  const timelineData = useMemo(() => {
    const last30 = entries.filter(e => {
      const d = new Date(e.created_at);
      return d.getTime() > Date.now() - 30 * 86400000;
    }).reverse();

    return last30.map(e => ({
      date: new Date(e.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      entity: e.entity_name.slice(0, 20),
      type: DECISION_TYPES[e.decision_type]?.label || e.decision_type,
      status: e.status,
      cpaBefore: e.metric_before?.cpa || 0,
      cpaAfter: e.metric_after?.cpa || 0,
    }));
  }, [entries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Log de Decisões
          {entries.length > 0 && (
            <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
          )}
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={analyzeDecisions} disabled={analyzing || entries.length < 3}>
            {analyzing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Bot className="h-3.5 w-3.5 mr-1" />}
            Analisar decisões
          </Button>
          <Button size="sm" onClick={() => {
            setNewForm(prev => ({ ...prev, metric_before: currentKpis }));
            setShowNewDecision(true);
          }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Registrar decisão
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total decisões</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.successRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{formatCurrency(stats.savings)}</p>
            <p className="text-xs text-muted-foreground">Economia CPL</p>
          </CardContent>
        </Card>
      </div>

      {/* Claude analysis result */}
      {analysisResult && (
        <Card className="glass-card border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase font-semibold text-primary flex items-center gap-1">
                <Bot className="h-3.5 w-3.5" /> Análise IA
              </p>
              <Button size="sm" variant="ghost" className="h-6" onClick={() => setAnalysisResult(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
              {analysisResult}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="list" className="text-xs gap-1">
            <History className="h-3.5 w-3.5" /> Decisões
          </TabsTrigger>
          <TabsTrigger value="patterns" className="text-xs gap-1">
            <BarChart3 className="h-3.5 w-3.5" /> Padrões
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs gap-1">
            <Calendar className="h-3.5 w-3.5" /> Timeline
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB: LIST ═══ */}
        <TabsContent value="list" className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." className="h-8 text-xs w-40" value={searchText} onChange={e => setSearchText(e.target.value)} />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {Object.entries(DECISION_TYPES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Entidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {uniqueEntities.map(e => (
                  <SelectItem key={e} value={e}>{e.length > 25 ? e.slice(0, 25) + '…' : e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uniqueTags.length > 0 && (
              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas tags</SelectItem>
                  {uniqueTags.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasFilters && (
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => {
                setFilterType('all'); setFilterStatus('all'); setFilterEntity('all'); setFilterTag('all'); setSearchText('');
              }}>
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>

          {/* Decision cards */}
          {filtered.length === 0 && (
            <Card className="glass-card">
              <CardContent className="py-10 text-center text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">{hasFilters ? 'Nenhuma decisão com esses filtros.' : 'Nenhuma decisão registrada ainda.'}</p>
                <p className="text-xs mt-1">Clique em "Registrar decisão" para começar.</p>
              </CardContent>
            </Card>
          )}

          <AnimatePresence>
            {filtered.map(entry => {
              const dt = DECISION_TYPES[entry.decision_type] || DECISION_TYPES.outro;
              const st = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
              const needsConfirmation = (entry.status === 'pending' || entry.status === 'monitoring') &&
                (Date.now() - new Date(entry.created_at).getTime() > 48 * 3600000);

              return (
                <motion.div key={entry.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Card className={`glass-card group ${needsConfirmation ? 'border-amber-500/40' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`mt-0.5 ${dt.color}`}>{dt.icon}</div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{entry.entity_name}</span>
                            <Badge variant="outline" className={`text-[10px] ${st.color}`}>{st.emoji} {st.label}</Badge>
                            <Badge variant="outline" className="text-[10px]">{dt.label}</Badge>
                            {entry.tags.map(t => (
                              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                            ))}
                            {needsConfirmation && (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] animate-pulse">
                                ⏰ Confirmar impacto
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground">{entry.reason}</p>

                          {/* KPI comparison */}
                          {entry.metric_before && Object.keys(entry.metric_before).length > 0 && (
                            <div className="flex flex-wrap gap-3 text-xs">
                              {Object.entries(entry.metric_before).slice(0, 4).map(([key, val]) => {
                                const after = entry.metric_after?.[key];
                                const improved = after != null && (
                                  ['cpa', 'cpm'].includes(key) ? after < val : after > val
                                );
                                return (
                                  <span key={key} className="text-muted-foreground">
                                    <span className="uppercase text-[10px] font-medium">{key}:</span>{' '}
                                    {formatKpi(key, val)}
                                    {after != null && (
                                      <>
                                        {' '}<ArrowRight className="h-3 w-3 inline" />{' '}
                                        <span className={improved ? 'text-emerald-400' : 'text-red-400'}>
                                          {formatKpi(key, after)} {improved ? '✅' : '❌'}
                                        </span>
                                      </>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {entry.actual_impact && (
                            <p className="text-xs text-foreground/70">
                              <span className="font-medium">Resultado:</span> {entry.actual_impact}
                            </p>
                          )}

                          <p className="text-[10px] text-muted-foreground">
                            {timeAgo(entry.created_at)} • {entry.entity_type}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {(entry.status === 'pending' || entry.status === 'monitoring') && (
                            <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => {
                              setConfirmForm({
                                metric_after: { ...entry.metric_before },
                                actual_impact: '',
                                evaluation: 'confirmed',
                              });
                              setShowConfirmImpact(entry);
                            }}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Confirmar
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-[10px] h-7 text-destructive" onClick={() => deleteEntry(entry.id)}>
                            <X className="h-3 w-3 mr-1" /> Remover
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </TabsContent>

        {/* ═══ TAB: PATTERNS ═══ */}
        <TabsContent value="patterns" className="space-y-4">
          {!patternData ? (
            <Card className="glass-card">
              <CardContent className="py-10 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Registre pelo menos 5 decisões para ver padrões.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Success rate by type */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Taxa de sucesso por tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={patternData.successByType} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={120} />
                      <RechartsTooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`${v}%`, 'Sucesso']}
                      />
                      <Bar dataKey="successRate" radius={[0, 4, 4, 0]}>
                        {patternData.successByType.map((_, i) => (
                          <Cell key={i} fill={`hsl(var(--primary) / ${0.4 + (i * 0.1)})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Decisions by day of week */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Decisões por dia da semana</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={patternData.byDayData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Stats table */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Detalhamento por tipo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {patternData.successByType.map(row => (
                      <div key={row.type} className="flex items-center justify-between p-2 rounded bg-secondary/20 text-xs">
                        <span className="font-medium">{row.type}</span>
                        <div className="flex gap-4 text-muted-foreground">
                          <span>{row.total} decisões</span>
                          <span className={row.successRate >= 60 ? 'text-emerald-400' : row.successRate >= 40 ? 'text-amber-400' : 'text-red-400'}>
                            {row.successRate}% sucesso
                          </span>
                          {row.avgDays > 0 && <span>~{row.avgDays}d até confirmação</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ═══ TAB: TIMELINE ═══ */}
        <TabsContent value="timeline" className="space-y-4">
          {timelineData.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-10 text-center text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Registre decisões para ver a timeline.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* CPA trend with decisions overlay */}
              {timelineData.some(t => t.cpaBefore > 0) && (
                <Card className="glass-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">CPA: Antes vs Depois das decisões</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={timelineData.filter(t => t.cpaBefore > 0)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="cpaBefore" name="CPA Antes" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cpaAfter" name="CPA Depois" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Visual timeline */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Timeline de decisões</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative space-y-0">
                    {timelineData.map((item, i) => {
                      const stConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                      return (
                        <div key={i} className="flex gap-3 items-start pb-4">
                          <div className="flex flex-col items-center">
                            <div className={`h-3 w-3 rounded-full border-2 ${
                              item.status === 'confirmed' ? 'bg-emerald-400 border-emerald-400' :
                              item.status === 'reversed' ? 'bg-red-400 border-red-400' :
                              'bg-amber-400 border-amber-400'
                            }`} />
                            {i < timelineData.length - 1 && <div className="w-px h-full bg-border/30 mt-1" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">{item.date}</span>
                              <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                              <Badge variant="outline" className={`text-[10px] ${stConfig.color}`}>{stConfig.emoji} {stConfig.label}</Badge>
                            </div>
                            <p className="text-xs font-medium text-foreground mt-0.5 truncate">{item.entity}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ MODAL: NEW DECISION ═══ */}
      <Dialog open={showNewDecision} onOpenChange={setShowNewDecision}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Registrar Decisão
            </DialogTitle>
            <DialogDescription>Registre uma decisão de otimização para acompanhar o impacto.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo de decisão</label>
              <Select value={newForm.decision_type} onValueChange={v => setNewForm(prev => ({ ...prev, decision_type: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DECISION_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Entity */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nível</label>
                <Select value={newForm.entity_type} onValueChange={v => setNewForm(prev => ({ ...prev, entity_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campaign">Campanha</SelectItem>
                    <SelectItem value="adset">Ad Set</SelectItem>
                    <SelectItem value="ad">Anúncio</SelectItem>
                    <SelectItem value="account">Conta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Entidade</label>
                <Input
                  className="h-9 text-sm"
                  placeholder="Nome da campanha/adset/ad"
                  value={newForm.entity_name}
                  onChange={e => setNewForm(prev => ({ ...prev, entity_name: e.target.value }))}
                  list="entity-suggestions"
                />
                <datalist id="entity-suggestions">
                  {(entityOptions[newForm.entity_type as keyof typeof entityOptions] || []).map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Motivo</label>
              <Textarea className="text-sm h-16" placeholder='Ex: "CTR caiu abaixo de 1% por 3 dias consecutivos"'
                value={newForm.reason} onChange={e => setNewForm(prev => ({ ...prev, reason: e.target.value }))} />
            </div>

            {/* Action taken */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ação tomada</label>
              <Textarea className="text-sm h-16" placeholder="Descreva a ação executada"
                value={newForm.action_taken} onChange={e => setNewForm(prev => ({ ...prev, action_taken: e.target.value }))} />
            </div>

            {/* KPIs */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">KPIs no momento (auto-preenchidos)</label>
              <div className="grid grid-cols-3 gap-2">
                {['spend', 'cpa', 'ctr', 'cpm', 'roas', 'frequency'].map(key => (
                  <div key={key}>
                    <label className="text-[10px] text-muted-foreground uppercase">{key}</label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={newForm.metric_before[key] ?? currentKpis[key as keyof typeof currentKpis] ?? ''}
                      onChange={e => setNewForm(prev => ({
                        ...prev,
                        metric_before: { ...prev.metric_before, [key]: parseFloat(e.target.value) || 0 }
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Expected impact */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Impacto esperado</label>
              <Textarea className="text-sm h-12" placeholder="O que se espera como resultado"
                value={newForm.expected_impact} onChange={e => setNewForm(prev => ({ ...prev, expected_impact: e.target.value }))} />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_OPTIONS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setNewForm(prev => ({
                      ...prev,
                      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
                    }))}
                    className={`px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      newForm.tags.includes(tag)
                        ? 'bg-primary/20 text-primary border-primary/40'
                        : 'bg-secondary/30 text-muted-foreground border-border/30 hover:bg-secondary/50'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewDecision(false)}>Cancelar</Button>
            <Button onClick={saveNewDecision} disabled={!newForm.entity_name || !newForm.reason}>
              Salvar decisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ MODAL: CONFIRM IMPACT ═══ */}
      <Dialog open={!!showConfirmImpact} onOpenChange={open => { if (!open) setShowConfirmImpact(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-400" /> Confirmar Impacto
            </DialogTitle>
            <DialogDescription>
              {showConfirmImpact?.entity_name} — {DECISION_TYPES[showConfirmImpact?.decision_type || '']?.label}
            </DialogDescription>
          </DialogHeader>

          {showConfirmImpact && (
            <div className="space-y-4">
              {/* Before KPIs */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">KPIs ANTES (registrados na decisão)</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(showConfirmImpact.metric_before || {}).map(([key, val]) => (
                    <div key={key} className="p-2 rounded bg-secondary/20 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">{key}</p>
                      <p className="text-sm font-medium">{formatKpi(key, val as number)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* After KPIs */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">KPIs DEPOIS (preencha com dados atuais)</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(showConfirmImpact.metric_before || {}).map(key => (
                    <div key={key}>
                      <label className="text-[10px] text-muted-foreground uppercase">{key}</label>
                      <Input
                        type="number"
                        className="h-7 text-xs"
                        value={confirmForm.metric_after[key] ?? ''}
                        onChange={e => setConfirmForm(prev => ({
                          ...prev,
                          metric_after: { ...prev.metric_after, [key]: parseFloat(e.target.value) || 0 }
                        }))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* What happened */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">O que aconteceu de fato?</label>
                <Textarea className="text-sm h-20" placeholder="Descreva o resultado real..."
                  value={confirmForm.actual_impact}
                  onChange={e => setConfirmForm(prev => ({ ...prev, actual_impact: e.target.value }))} />
              </div>

              {/* Evaluation */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Avaliação</label>
                <div className="flex gap-2">
                  {[
                    { key: 'confirmed', label: '✅ Funcionou', color: 'border-emerald-500/40 bg-emerald-500/10' },
                    { key: 'partial', label: '⚠️ Parcial', color: 'border-amber-500/40 bg-amber-500/10' },
                    { key: 'reversed', label: '❌ Reverter', color: 'border-red-500/40 bg-red-500/10' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setConfirmForm(prev => ({ ...prev, evaluation: opt.key as any }))}
                      className={`flex-1 p-2 rounded-lg text-xs font-medium border transition-colors ${
                        confirmForm.evaluation === opt.key ? opt.color : 'border-border/30 bg-secondary/20 hover:bg-secondary/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirmImpact(null)}>Cancelar</Button>
            <Button onClick={confirmImpact} disabled={!confirmForm.actual_impact}>
              {confirmForm.evaluation === 'reversed' ? 'Reverter decisão' : 'Confirmar impacto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
