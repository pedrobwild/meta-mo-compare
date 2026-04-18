import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AlertTriangle, Edit2, Check, Filter, Palette, Sparkles, TrendingDown, TrendingUp, BarChart2, Clock, Layers, Bot, Play, Pause, Image, Video, LayoutGrid, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid, Area, AreaChart } from 'recharts';
import ReactMarkdown from 'react-markdown';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/integrations/supabase/client';
import type { MetaRecord } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

// Types
type LifecycleStage = 'fresh' | 'peaking' | 'declining' | 'fatigued';
type AngleType = 'dor' | 'prova_social' | 'autoridade' | 'oferta' | 'demonstracao';

interface AdCreative {
  id: string;
  workspace_id: string;
  ad_id: string;
  ad_name: string;
  campaign_id: string | null;
  adset_id: string | null;
  thumbnail_url: string | null;
  creative_type: string | null;
  angle: string | null;
  hook: string | null;
  cta: string | null;
  first_seen_at: string | null;
  status: string;
  lifecycle_stage: string;
  lifecycle_updated_at: string | null;
  created_at: string;
}

interface DailyMetric {
  id: string;
  ad_id: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
  frequency: number;
  reach: number;
}

interface EnrichedCreative extends AdCreative {
  daily_metrics: DailyMetric[];
  days_active: number;
  total_spend: number;
  total_leads: number;
  avg_ctr: number;
  avg_cpl: number;
  avg_frequency: number;
  ctr_first3: number;
  ctr_last3: number;
  degradation_pct: number;
  peak_ctr: number;
}

// Config
const STAGE_CONFIG: Record<string, { label: string; badge: string; color: string; bgClass: string; action: string }> = {
  fresh: { label: 'Novo', badge: '🆕', color: 'text-primary', bgClass: 'bg-primary/10 text-primary border-primary/30', action: 'Aguardar 48h' },
  peaking: { label: 'Escalando', badge: '🚀', color: 'text-positive', bgClass: 'bg-positive/10 text-positive border-positive/30', action: '🚀 Escalar +20%' },
  declining: { label: 'Declinando', badge: '⚠️', color: 'text-warning', bgClass: 'bg-warning/10 text-warning border-warning/30', action: '⚠️ Preparar substituto' },
  fatigued: { label: 'Fadigado', badge: '🔴', color: 'text-destructive', bgClass: 'bg-destructive/10 text-destructive border-destructive/30', action: '🔴 Pausar agora' },
};

const ANGLE_LABELS: Record<string, string> = {
  dor: 'Dor',
  prova_social: 'Prova Social',
  autoridade: 'Autoridade',
  oferta: 'Oferta',
  demonstracao: 'Demonstração',
};

const TYPE_ICONS: Record<string, any> = {
  video: Video,
  image: Image,
  carousel: LayoutGrid,
};

function safe(n: number, d: number) { return d > 0 ? n / d : 0; }
function brl(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.fresh;
  return <Badge variant="outline" className={`text-[10px] font-mono border ${cfg.bgClass}`}>{cfg.badge} {cfg.label}</Badge>;
}

// ─── CreativesRankingTable (virtualized) ───
// Large accounts can have hundreds of creative ads. We use table-row
// virtualization (spacer rows above/below the visible window) so the DOM
// stays small even with a big filtered list.
function CreativesRankingTable({
  filtered,
  onAnalyze,
}: {
  filtered: EnrichedCreative[];
  onAnalyze: (c: EnrichedCreative) => void;
}) {
  const ROW_HEIGHT = 40;
  const VIRTUAL_THRESHOLD = 60;
  const shouldVirtualize = filtered.length > VIRTUAL_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];
  const totalSize = shouldVirtualize ? virtualizer.getTotalSize() : 0;
  const topPad = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const bottomPad =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;
  const visible = shouldVirtualize ? virtualItems.map((vi) => filtered[vi.index]) : filtered;

  return (
    <div className="glass-panel overflow-hidden">
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={shouldVirtualize ? { maxHeight: '65vh' } : undefined}
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <TableRow>
              <TableHead className="text-[10px]">Criativo</TableHead>
              <TableHead className="text-[10px]">Estágio</TableHead>
              <TableHead className="text-[10px] text-right">Dias</TableHead>
              <TableHead className="text-[10px] text-right">CTR</TableHead>
              <TableHead className="text-[10px] text-right">Δ CTR</TableHead>
              <TableHead className="text-[10px] text-right">CPL</TableHead>
              <TableHead className="text-[10px] text-right">Freq.</TableHead>
              <TableHead className="text-[10px] text-right">Spend</TableHead>
              <TableHead className="text-[10px] text-right">Leads</TableHead>
              <TableHead className="text-[10px]">Ação Sugerida</TableHead>
              <TableHead className="text-[10px]">IA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shouldVirtualize && topPad > 0 && (
              <tr aria-hidden style={{ height: `${topPad}px` }}>
                <td colSpan={11} />
              </tr>
            )}
            {visible.map((c) => {
              const cfg = STAGE_CONFIG[c.lifecycle_stage] || STAGE_CONFIG.fresh;
              const degradColor =
                c.degradation_pct > 30
                  ? 'text-red-400'
                  : c.degradation_pct > 15
                    ? 'text-amber-400'
                    : 'text-emerald-400';
              return (
                <TableRow
                  key={c.id}
                  className={
                    c.lifecycle_stage === 'fatigued'
                      ? 'bg-red-500/5'
                      : c.lifecycle_stage === 'declining'
                        ? 'bg-amber-500/5'
                        : ''
                  }
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  <TableCell className="text-xs font-medium max-w-[180px] truncate" title={c.ad_name}>
                    {c.ad_name}
                  </TableCell>
                  <TableCell>
                    <StageBadge stage={c.lifecycle_stage} />
                  </TableCell>
                  <TableCell className="text-xs font-mono text-right">{c.days_active}d</TableCell>
                  <TableCell className="text-xs font-mono text-right">{c.avg_ctr.toFixed(2)}%</TableCell>
                  <TableCell className={`text-xs font-mono text-right font-bold ${degradColor}`}>
                    {c.degradation_pct > 0 ? '-' : ''}
                    {c.degradation_pct.toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-xs font-mono text-right">
                    {c.avg_cpl > 0 ? brl(c.avg_cpl) : '—'}
                  </TableCell>
                  <TableCell
                    className={`text-xs font-mono text-right ${
                      c.avg_frequency > 3.5
                        ? 'text-red-400 font-bold'
                        : c.avg_frequency > 2.5
                          ? 'text-amber-400'
                          : ''
                    }`}
                  >
                    {c.avg_frequency.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-right">{brl(c.total_spend)}</TableCell>
                  <TableCell className="text-xs font-mono text-right">{c.total_leads}</TableCell>
                  <TableCell className="text-[10px]">{cfg.action}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onAnalyze(c)}
                    >
                      <Bot className="h-3 w-3 text-primary" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {shouldVirtualize && bottomPad > 0 && (
              <tr aria-hidden style={{ height: `${bottomPad}px` }}>
                <td colSpan={11} />
              </tr>
            )}
          </TableBody>
        </Table>
      </div>
      {filtered.length > 0 && (
        <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
          {shouldVirtualize
            ? `${filtered.length} criativos · virtualização ativa`
            : `${filtered.length} criativos`}
        </div>
      )}
    </div>
  );
}

function enrichCreatives(creatives: AdCreative[], allMetrics: DailyMetric[]): EnrichedCreative[] {
  const metricsByAd = new Map<string, DailyMetric[]>();
  for (const m of allMetrics) {
    const list = metricsByAd.get(m.ad_id) || [];
    list.push(m);
    metricsByAd.set(m.ad_id, list);
  }

  return creatives.map(c => {
    const metrics = (metricsByAd.get(c.ad_id) || []).sort((a, b) => a.date.localeCompare(b.date));
    const daysActive = metrics.length;
    const totalSpend = metrics.reduce((s, m) => s + Number(m.spend), 0);
    const totalLeads = metrics.reduce((s, m) => s + Number(m.leads), 0);
    const avgCtr = daysActive > 0 ? metrics.reduce((s, m) => s + Number(m.ctr), 0) / daysActive : 0;
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const avgFrequency = daysActive > 0 ? metrics.reduce((s, m) => s + Number(m.frequency), 0) / daysActive : 0;
    
    const first3 = metrics.slice(0, 3);
    const last3 = metrics.slice(-3);
    const ctrFirst3 = first3.length > 0 ? first3.reduce((s, m) => s + Number(m.ctr), 0) / first3.length : 0;
    const ctrLast3 = last3.length > 0 ? last3.reduce((s, m) => s + Number(m.ctr), 0) / last3.length : 0;
    const peakCtr = metrics.length > 0 ? Math.max(...metrics.map(m => Number(m.ctr))) : 0;
    const degradation = peakCtr > 0 ? Math.max(0, ((peakCtr - ctrLast3) / peakCtr) * 100) : 0;

    return {
      ...c,
      daily_metrics: metrics,
      days_active: daysActive,
      total_spend: totalSpend,
      total_leads: totalLeads,
      avg_ctr: avgCtr,
      avg_cpl: avgCpl,
      avg_frequency: avgFrequency,
      ctr_first3: ctrFirst3,
      ctr_last3: ctrLast3,
      degradation_pct: degradation,
      peak_ctr: peakCtr,
    };
  });
}

// ─── Analysis Modal ────────────────────────────────────────
function AnalysisModal({ creative, open, onClose, accountAvgs }: {
  creative: EnrichedCreative | null;
  open: boolean;
  onClose: () => void;
  accountAvgs: { ctr: number; cpl: number; freq: number };
}) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !creative) return;
    setAnalysis('');
    setLoading(true);

    const run = async () => {
      try {
        const resp = await supabase.functions.invoke('analyze-creative', {
          body: {
            mode: 'individual',
            creativeData: {
              ad_name: creative.ad_name,
              angle: creative.angle,
              hook: creative.hook,
              cta: creative.cta,
              creative_type: creative.creative_type,
              days_active: creative.days_active,
              lifecycle_stage: creative.lifecycle_stage,
              daily_metrics: creative.daily_metrics.slice(-14),
              account_avg_ctr: accountAvgs.ctr,
              account_avg_cpl: accountAvgs.cpl,
              account_avg_freq: accountAvgs.freq,
              cpl_meta: accountAvgs.cpl,
            },
          },
        });

        if (resp.error) throw resp.error;

        // Parse SSE stream from response
        const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        
        // Handle Anthropic SSE format
        const lines = text.split('\n');
        let fullText = '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullText += parsed.delta.text;
              }
            } catch { /* skip */ }
          }
        }
        
        if (fullText) {
          setAnalysis(fullText);
        } else if (resp.data?.content?.[0]?.text) {
          setAnalysis(resp.data.content[0].text);
        } else {
          setAnalysis(text);
        }
      } catch (e: any) {
        console.error(e);
        setAnalysis(`Erro ao analisar: ${e.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open, creative]);

  if (!creative) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-panel max-w-2xl max-h-[80vh] rounded-meta-modal">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Análise IA — {creative.ad_name}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Analisando criativo...</span>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Portfolio Analysis Modal ──────────────────────────────
function PortfolioAnalysisModal({ open, onClose, creatives, accountAvgs }: {
  open: boolean;
  onClose: () => void;
  creatives: EnrichedCreative[];
  accountAvgs: { ctr: number; cpl: number; freq: number };
}) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !creatives.length) return;
    setAnalysis('');
    setLoading(true);

    const run = async () => {
      try {
        const byCounts = { fresh: 0, peaking: 0, declining: 0, fatigued: 0 };
        creatives.forEach(c => { byCounts[c.lifecycle_stage as keyof typeof byCounts] = (byCounts[c.lifecycle_stage as keyof typeof byCounts] || 0) + 1; });

        const angleGroups: Record<string, { count: number; avg_ctr: number; avg_cpl: number; peaking: number }> = {};
        creatives.forEach(c => {
          const a = c.angle || 'não definido';
          if (!angleGroups[a]) angleGroups[a] = { count: 0, avg_ctr: 0, avg_cpl: 0, peaking: 0 };
          angleGroups[a].count++;
          angleGroups[a].avg_ctr += c.avg_ctr;
          angleGroups[a].avg_cpl += c.avg_cpl;
          if (c.lifecycle_stage === 'peaking') angleGroups[a].peaking++;
        });
        Object.values(angleGroups).forEach(g => {
          g.avg_ctr = g.count > 0 ? g.avg_ctr / g.count : 0;
          g.avg_cpl = g.count > 0 ? g.avg_cpl / g.count : 0;
        });

        const sorted = [...creatives].sort((a, b) => b.avg_ctr - a.avg_ctr);
        const top3 = sorted.slice(0, 3).map(c => ({ name: c.ad_name, ctr: c.avg_ctr, cpl: c.avg_cpl, stage: c.lifecycle_stage }));
        const worst3 = sorted.slice(-3).reverse().map(c => ({ name: c.ad_name, ctr: c.avg_ctr, cpl: c.avg_cpl, stage: c.lifecycle_stage }));

        const resp = await supabase.functions.invoke('analyze-creative', {
          body: {
            mode: 'portfolio',
            portfolioData: {
              total: creatives.length,
              ...byCounts,
              peaking_count: byCounts.peaking,
              declining_count: byCounts.declining,
              fatigued_count: byCounts.fatigued,
              fresh_count: byCounts.fresh,
              angles: angleGroups,
              top_creatives: top3,
              worst_creatives: worst3,
              avg_ctr: accountAvgs.ctr,
              avg_cpl: accountAvgs.cpl,
              avg_freq: accountAvgs.freq,
              paused_count: creatives.filter(c => c.status === 'paused').length,
            },
          },
        });

        if (resp.error) throw resp.error;

        const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        const lines = text.split('\n');
        let fullText = '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullText += parsed.delta.text;
              }
            } catch { /* skip */ }
          }
        }
        setAnalysis(fullText || (resp.data?.content?.[0]?.text) || text);
      } catch (e: any) {
        console.error(e);
        setAnalysis(`Erro: ${e.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-panel max-w-2xl max-h-[80vh] rounded-meta-modal">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Análise do Portfólio de Criativos
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Analisando portfólio...</span>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Creative Dialog ──────────────────────────────────
function EditCreativeDialog({ creative, open, onClose, onSaved }: {
  creative: EnrichedCreative;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [creativeType, setCreativeType] = useState(creative.creative_type || '');
  const [angle, setAngle] = useState(creative.angle || '');
  const [hook, setHook] = useState(creative.hook || '');
  const [cta, setCta] = useState(creative.cta || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('ad_creatives').update({
        creative_type: creativeType || null,
        angle: angle || null,
        hook: hook || null,
        cta: cta || null,
      } as any).eq('id', creative.id);
      toast.success('Criativo atualizado');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-panel max-w-sm rounded-meta-modal">
        <DialogHeader>
          <DialogTitle className="text-sm">Editar Criativo</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground truncate">{creative.ad_name}</p>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo</label>
            <Select value={creativeType} onValueChange={setCreativeType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {['video', 'image', 'carousel'].map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Ângulo</label>
            <Select value={angle} onValueChange={setAngle}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {Object.entries(ANGLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Hook (0-3s)</label>
            <input className="w-full h-8 text-xs rounded-md border border-border bg-background px-2" value={hook} onChange={e => setHook(e.target.value)} placeholder="Descreva o hook..." />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">CTA</label>
            <input className="w-full h-8 text-xs rounded-md border border-border bg-background px-2" value={cta} onChange={e => setCta(e.target.value)} placeholder="Ex: Agende diagnóstico" />
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="w-full text-xs gap-1">
            <Check className="h-3 w-3" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Summary Cards ─────────────────────────────────────────
function SummaryCards({ creatives, accountAvgCtr, avgDegradation }: {
  creatives: EnrichedCreative[];
  accountAvgCtr: number;
  avgDegradation: number;
}) {
  const active = creatives.filter(c => c.status === 'active');
  const peaking = active.filter(c => c.lifecycle_stage === 'peaking').length;
  const fatigued = active.filter(c => c.lifecycle_stage === 'fatigued').length;

  const cards = [
    { label: 'Criativos Ativos', value: active.length, icon: Layers, color: 'text-foreground' },
    { label: 'Em Peaking', value: peaking, icon: TrendingUp, color: 'text-positive' },
    { label: 'Fatigued', value: fatigued, icon: TrendingDown, color: 'text-destructive' },
    { label: 'CTR Médio', value: `${accountAvgCtr.toFixed(2)}%`, icon: Eye, color: 'text-primary' },
    { label: 'Degradação Média', value: `${avgDegradation.toFixed(0)}%`, icon: TrendingDown, color: avgDegradation > 25 ? 'text-destructive' : 'text-warning' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="glass-panel">
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <c.icon className={`h-4 w-4 ${c.color}`} />
              <p className={`text-lg font-bold font-mono ${c.color}`}>{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Creative Card (Grid) ──────────────────────────────────
function CreativeCard({ creative, onAnalyze, onEdit }: {
  creative: EnrichedCreative;
  onAnalyze: () => void;
  onEdit: () => void;
}) {
  const cfg = STAGE_CONFIG[creative.lifecycle_stage] || STAGE_CONFIG.fresh;
  const degradColor = creative.degradation_pct > 30 ? 'text-destructive' : creative.degradation_pct > 15 ? 'text-warning' : 'text-positive';
  const TypeIcon = TYPE_ICONS[creative.creative_type || ''] || Image;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel p-3 space-y-2 ${creative.lifecycle_stage === 'fatigued' ? 'border-destructive/30' : creative.lifecycle_stage === 'declining' ? 'border-warning/20' : ''}`}
    >
      {/* Thumbnail */}
      {creative.thumbnail_url ? (
        <div className="h-28 rounded-md overflow-hidden bg-muted">
          <img src={creative.thumbnail_url} alt={creative.ad_name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-28 rounded-md bg-muted/30 flex items-center justify-center">
          <TypeIcon className="h-8 w-8 text-muted-foreground/30" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate" title={creative.ad_name}>{creative.ad_name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{creative.campaign_id || '—'}</p>
        </div>
        <StageBadge stage={creative.lifecycle_stage} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[9px] text-muted-foreground">CTR</p>
          <p className="text-xs font-mono font-bold">{creative.avg_ctr.toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">CPL</p>
          <p className="text-xs font-mono font-bold">{creative.avg_cpl > 0 ? brl(creative.avg_cpl) : '—'}</p>
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground">Freq.</p>
          <p className="text-xs font-mono font-bold">{creative.avg_frequency.toFixed(1)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{creative.days_active}d no ar • {brl(creative.total_spend)}</span>
        <span className={`font-mono font-bold ${degradColor}`}>
          {creative.degradation_pct > 0 ? '↓' : '→'} {creative.degradation_pct.toFixed(0)}%
        </span>
      </div>

      {/* Tags */}
      <div className="flex gap-1 flex-wrap">
        {creative.creative_type && <Badge variant="secondary" className="text-[9px] h-4">{creative.creative_type}</Badge>}
        {creative.angle && <Badge variant="secondary" className="text-[9px] h-4">{ANGLE_LABELS[creative.angle] || creative.angle}</Badge>}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" className="flex-1 text-[10px] h-7 gap-1" onClick={onAnalyze}>
          <Bot className="h-3 w-3" /> Análise IA
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Edit2 className="h-3 w-3" />
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Tab: Degradation Charts ───────────────────────────────
function DegradationTab({ creatives }: { creatives: EnrichedCreative[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const creative = creatives.find(c => c.ad_id === selected) || creatives[0];

  if (!creative || !creative.daily_metrics.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem dados de métricas diárias para análise de degradação.</p>;
  }

  const chartData = creative.daily_metrics.map(m => ({
    date: m.date.slice(5),
    ctr: Number(m.ctr),
    frequency: Number(m.frequency),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={selected || creative.ad_id} onValueChange={setSelected}>
          <SelectTrigger className="h-8 text-xs max-w-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {creatives.filter(c => c.daily_metrics.length > 0).map(c => (
              <SelectItem key={c.ad_id} value={c.ad_id} className="text-xs">{c.ad_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <StageBadge stage={creative.lifecycle_stage} />
        <span className="text-xs text-muted-foreground">Degradação: <span className={`font-bold ${creative.degradation_pct > 30 ? 'text-destructive' : 'text-warning'}`}>{creative.degradation_pct.toFixed(1)}%</span></span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CTR Chart */}
        <div className="glass-panel p-4 space-y-2">
          <h4 className="text-xs font-semibold">CTR dia a dia</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(2)}%`, 'CTR']} />
                <ReferenceLine y={creative.ctr_first3} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={{ value: `Ref: ${creative.ctr_first3.toFixed(2)}%`, fontSize: 9, fill: 'hsl(var(--primary))' }} />
                {creative.avg_ctr < 1.0 && <ReferenceLine y={1.0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: 'Crítico 1%', fontSize: 9, fill: 'hsl(var(--destructive))' }} />}
                <Area type="monotone" dataKey="ctr" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Frequency Chart */}
        <div className="glass-panel p-4 space-y-2">
          <h4 className="text-xs font-semibold">Frequência ao longo do tempo</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [v.toFixed(2), 'Freq.']} />
                <ReferenceLine y={2.5} stroke="hsl(var(--warning))" strokeDasharray="5 5" label={{ value: '2.5', fontSize: 9, fill: 'hsl(var(--warning))' }} />
                <ReferenceLine y={3.5} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: '3.5', fontSize: 9, fill: 'hsl(var(--destructive))' }} />
                <Area type="monotone" dataKey="frequency" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Angle Library ────────────────────────────────────
function AngleLibraryTab({ creatives }: { creatives: EnrichedCreative[] }) {
  const angleStats = useMemo(() => {
    const groups: Record<string, { count: number; avg_ctr: number; avg_cpl: number; peaking: number; total: number }> = {};
    
    creatives.forEach(c => {
      const a = c.angle || 'não definido';
      if (!groups[a]) groups[a] = { count: 0, avg_ctr: 0, avg_cpl: 0, peaking: 0, total: 0 };
      groups[a].count++;
      groups[a].avg_ctr += c.avg_ctr;
      groups[a].avg_cpl += c.avg_cpl;
      groups[a].total++;
      if (c.lifecycle_stage === 'peaking') groups[a].peaking++;
    });

    return Object.entries(groups).map(([angle, stats]) => ({
      angle,
      label: ANGLE_LABELS[angle] || angle,
      count: stats.count,
      avg_ctr: stats.count > 0 ? stats.avg_ctr / stats.count : 0,
      avg_cpl: stats.count > 0 ? stats.avg_cpl / stats.count : 0,
      success_rate: stats.total > 0 ? (stats.peaking / stats.total) * 100 : 0,
    })).sort((a, b) => b.avg_ctr - a.avg_ctr);
  }, [creatives]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {angleStats.map((a, i) => (
          <motion.div key={a.angle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="glass-panel">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center justify-between">
                  {a.label}
                  <Badge variant="secondary" className="text-[10px]">{a.count} criativos</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-1 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[9px] text-muted-foreground">CTR Médio</p>
                    <p className="text-sm font-mono font-bold">{a.avg_ctr.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">CPL Médio</p>
                    <p className="text-sm font-mono font-bold">{a.avg_cpl > 0 ? brl(a.avg_cpl) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">% Sucesso</p>
                    <p className={`text-sm font-mono font-bold ${a.success_rate > 50 ? 'text-positive' : a.success_rate > 20 ? 'text-warning' : 'text-destructive'}`}>
                      {a.success_rate.toFixed(0)}%
                    </p>
                  </div>
                </div>
                <Progress value={a.success_rate} className="h-1.5" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      {angleStats.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Defina ângulos nos criativos para ver a biblioteca de performance.
        </p>
      )}
    </div>
  );
}

// ─── Tab: Timeline ─────────────────────────────────────────
function TimelineTab({ creatives }: { creatives: EnrichedCreative[] }) {
  const sorted = useMemo(() => 
    [...creatives]
      .filter(c => c.first_seen_at)
      .sort((a, b) => (b.first_seen_at || '').localeCompare(a.first_seen_at || '')),
    [creatives]
  );

  // Check gap
  const dates = sorted.map(c => c.first_seen_at!).sort();
  const lastLaunch = dates.length > 0 ? dates[dates.length - 1] : null;
  const daysSinceLastLaunch = lastLaunch ? Math.ceil((Date.now() - new Date(lastLaunch).getTime()) / 86400000) : 0;

  return (
    <div className="space-y-4">
      {daysSinceLastLaunch > 7 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-3 border-amber-500/30 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-400">📅 {daysSinceLastLaunch} dias sem novo criativo</p>
            <p className="text-[10px] text-muted-foreground">Risco de fadiga geral. Lance 2-3 novas peças esta semana.</p>
          </div>
        </motion.div>
      )}

      <div className="space-y-2">
        {sorted.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="glass-panel p-3 flex items-center gap-3">
            <div className="flex-shrink-0 w-16 text-center">
              <p className="text-[10px] text-muted-foreground">{c.first_seen_at?.slice(5)}</p>
              <p className="text-[9px] text-muted-foreground/60">{c.days_active}d</p>
            </div>
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
              c.lifecycle_stage === 'fatigued' ? 'bg-red-500' :
              c.lifecycle_stage === 'declining' ? 'bg-amber-500' :
              c.lifecycle_stage === 'peaking' ? 'bg-emerald-500' : 'bg-blue-500'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{c.ad_name}</p>
              <div className="flex items-center gap-2">
                <StageBadge stage={c.lifecycle_stage} />
                {c.status === 'paused' && <Badge variant="outline" className="text-[9px] border-muted-foreground/30">Pausado</Badge>}
              </div>
            </div>
            <div className="text-right text-[10px] text-muted-foreground">
              <p>CTR {c.avg_ctr.toFixed(2)}%</p>
              <p>{brl(c.total_spend)}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum criativo com data de lançamento definida.</p>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────
export default function CreativesView() {
  const { workspace } = useWorkspace();
  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [angleFilter, setAngleFilter] = useState<string>('all');
  const [analyzingCreative, setAnalyzingCreative] = useState<EnrichedCreative | null>(null);
  const [editingCreative, setEditingCreative] = useState<EnrichedCreative | null>(null);
  const [portfolioAnalysisOpen, setPortfolioAnalysisOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const [creativesRes, metricsRes] = await Promise.all([
        supabase.from('ad_creatives').select('*').eq('workspace_id', workspace.id),
        supabase.from('creative_daily_metrics').select('*').eq('workspace_id', workspace.id).order('date', { ascending: true }),
      ]);
      setCreatives((creativesRes.data as any[]) || []);
      setMetrics((metricsRes.data as any[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { loadData(); }, [loadData]);

  const enriched = useMemo(() => enrichCreatives(creatives, metrics), [creatives, metrics]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (stageFilter !== 'all') list = list.filter(c => c.lifecycle_stage === stageFilter);
    if (typeFilter !== 'all') list = list.filter(c => c.creative_type === typeFilter);
    if (angleFilter !== 'all') list = list.filter(c => c.angle === angleFilter);
    // Sort: fatigued first, then declining, fresh, peaking
    const order: Record<string, number> = { fatigued: 0, declining: 1, fresh: 2, peaking: 3 };
    list.sort((a, b) => (order[a.lifecycle_stage] ?? 4) - (order[b.lifecycle_stage] ?? 4));
    return list;
  }, [enriched, stageFilter, typeFilter, angleFilter]);

  const accountAvgs = useMemo(() => {
    const active = enriched.filter(c => c.status === 'active' && c.days_active > 0);
    const ctr = active.length > 0 ? active.reduce((s, c) => s + c.avg_ctr, 0) / active.length : 0;
    const cpl = active.length > 0 ? active.reduce((s, c) => s + c.avg_cpl, 0) / active.length : 0;
    const freq = active.length > 0 ? active.reduce((s, c) => s + c.avg_frequency, 0) / active.length : 0;
    return { ctr, cpl, freq };
  }, [enriched]);

  const avgDegradation = useMemo(() => {
    const withDeg = enriched.filter(c => c.days_active > 3);
    return withDeg.length > 0 ? withDeg.reduce((s, c) => s + c.degradation_pct, 0) / withDeg.length : 0;
  }, [enriched]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-pulse text-muted-foreground text-sm">Carregando criativos...</div>
      </div>
    );
  }

  if (enriched.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4 max-w-md">
          <div className="h-20 w-20 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Palette className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Módulo de Criativos</h2>
          <p className="text-sm text-muted-foreground">
            Sincronize dados do Meta Ads e cadastre seus criativos para analisar ciclo de vida, fadiga e degradação de performance.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Criativos</h2>
          <p className="text-xs text-muted-foreground">{enriched.length} criativos • Ciclo de vida e performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={() => setPortfolioAnalysisOpen(true)}>
            <Sparkles className="h-3 w-3" /> Analisar portfólio
          </Button>
        </div>
      </div>

      {/* Fatigued Alert */}
      {enriched.filter(c => c.lifecycle_stage === 'fatigued' && c.status === 'active').length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-3 border-red-500/30 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-red-400">
              🔴 {enriched.filter(c => c.lifecycle_stage === 'fatigued' && c.status === 'active').length} criativo(s) fadigado(s) ativo(s)
            </p>
            <p className="text-[10px] text-muted-foreground">Pausar ou substituir urgentemente para evitar desperdício de budget.</p>
          </div>
        </motion.div>
      )}

      {/* Summary Cards */}
      <SummaryCards creatives={enriched} accountAvgCtr={accountAvgs.ctr} avgDegradation={avgDegradation} />

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-7 w-32 text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos estágios</SelectItem>
            <SelectItem value="fresh" className="text-xs">🆕 Fresh</SelectItem>
            <SelectItem value="peaking" className="text-xs">🚀 Peaking</SelectItem>
            <SelectItem value="declining" className="text-xs">⚠️ Declining</SelectItem>
            <SelectItem value="fatigued" className="text-xs">🔴 Fatigued</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos tipos</SelectItem>
            <SelectItem value="video" className="text-xs">Vídeo</SelectItem>
            <SelectItem value="image" className="text-xs">Imagem</SelectItem>
            <SelectItem value="carousel" className="text-xs">Carrossel</SelectItem>
          </SelectContent>
        </Select>
        <Select value={angleFilter} onValueChange={setAngleFilter}>
          <SelectTrigger className="h-7 w-32 text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos ângulos</SelectItem>
            {Object.entries(ANGLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted/30 p-0.5">
          <TabsTrigger value="overview" className="text-xs gap-1"><Layers className="h-3 w-3" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs gap-1"><BarChart2 className="h-3 w-3" /> Ranking</TabsTrigger>
          <TabsTrigger value="degradation" className="text-xs gap-1"><TrendingDown className="h-3 w-3" /> Degradação</TabsTrigger>
          <TabsTrigger value="angles" className="text-xs gap-1"><Palette className="h-3 w-3" /> Ângulos</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs gap-1"><Clock className="h-3 w-3" /> Linha do Tempo</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview Grid */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.slice(0, 24).map(c => (
              <CreativeCard
                key={c.id}
                creative={c}
                onAnalyze={() => setAnalyzingCreative(c)}
                onEdit={() => setEditingCreative(c)}
              />
            ))}
          </div>
          {filtered.length > 24 && (
            <p className="text-[10px] text-muted-foreground text-center mt-3">Mostrando 24 de {filtered.length}. Veja todos no Ranking.</p>
          )}
        </TabsContent>

        {/* Tab 2: Ranking Table */}
        <TabsContent value="ranking">
          <CreativesRankingTable
            filtered={filtered}
            onAnalyze={setAnalyzingCreative}
          />
        </TabsContent>

        {/* Tab 3: Degradation */}
        <TabsContent value="degradation">
          <DegradationTab creatives={enriched.filter(c => c.daily_metrics.length > 0)} />
        </TabsContent>

        {/* Tab 4: Angles */}
        <TabsContent value="angles">
          <AngleLibraryTab creatives={enriched} />
        </TabsContent>

        {/* Tab 5: Timeline */}
        <TabsContent value="timeline">
          <TimelineTab creatives={enriched} />
        </TabsContent>
      </Tabs>

      {/* Analysis Modal */}
      <AnalysisModal
        creative={analyzingCreative}
        open={!!analyzingCreative}
        onClose={() => setAnalyzingCreative(null)}
        accountAvgs={accountAvgs}
      />

      {/* Portfolio Analysis Modal */}
      <PortfolioAnalysisModal
        open={portfolioAnalysisOpen}
        onClose={() => setPortfolioAnalysisOpen(false)}
        creatives={enriched}
        accountAvgs={accountAvgs}
      />

      {/* Edit Dialog */}
      {editingCreative && (
        <EditCreativeDialog
          creative={editingCreative}
          open={!!editingCreative}
          onClose={() => setEditingCreative(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
