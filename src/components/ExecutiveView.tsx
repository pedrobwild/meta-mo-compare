import { useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  computeDeltas,
  groupByLevel,
  getDateRangeLabel,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/calculations';
import { computeVerdict, type VerdictResult } from '@/lib/insights/verdicts';
import type { LeadQualityMetrics } from '@/lib/types';
import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  ZAxis,
} from 'recharts';

// ── Helpers ──────────────────────────────────────────

function safe(n: number, d: number) { return d > 0 ? n / d : 0; }

function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <div className="h-12 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#grad-${dataKey})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TrafficLight({ verdict }: { verdict: VerdictResult }) {
  const styles: Record<string, string> = {
    scale: 'bg-positive/10 border-positive/30 text-positive',
    keep: 'bg-primary/10 border-primary/30 text-primary',
    test_variation: 'bg-warning/10 border-warning/30 text-warning',
    watch: 'bg-warning/10 border-warning/30 text-warning',
    pause: 'bg-negative/10 border-negative/30 text-negative',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${styles[verdict.verdict] || styles.watch}`}>
      {verdict.emoji} {verdict.label}
    </span>
  );
}

// ── CPA Waterfall Mini ───────────────────────────────

function CPAWaterfallMini({ current, previous }: { current: any; previous: any | null }) {
  if (!previous) return null;

  const prevCPA = previous.cost_per_result || 0;
  const currCPA = current.cost_per_result || 0;
  if (prevCPA === 0) return null;

  // Decompose CPA = (Spend / Results) = (CPM / 1000) / (CTR * ConvRate)
  // Effect: CPM change, CTR change, Conversion Rate change
  const prevCPM = previous.cpm || 0;
  const currCPM = current.cpm || 0;
  const cpmEffect = prevCPA > 0 ? ((currCPM - prevCPM) / prevCPM) * 100 : 0;

  const prevCTR = previous.ctr_link || 0;
  const currCTR = current.ctr_link || 0;
  const ctrEffect = prevCTR > 0 ? -((currCTR - prevCTR) / prevCTR) * 100 : 0; // inverted: higher CTR = lower CPA

  const prevConv = safe(previous.results, previous.link_clicks);
  const currConv = safe(current.results, current.link_clicks);
  const convEffect = prevConv > 0 ? -((currConv - prevConv) / prevConv) * 100 : 0;

  const bars = [
    { label: 'CPM', value: cpmEffect, desc: 'Efeito Custo de Mídia' },
    { label: 'CTR', value: ctrEffect, desc: 'Efeito Engajamento' },
    { label: 'Conv.', value: convEffect, desc: 'Efeito Conversão' },
  ];

  const maxAbs = Math.max(...bars.map(b => Math.abs(b.value)), 1);

  return (
    <div className="glass-panel p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Decomposição do CPA</h3>
        <span className="text-[10px] font-mono text-muted-foreground">
          {formatCurrency(prevCPA)} → {formatCurrency(currCPA)}
        </span>
      </div>
      <div className="space-y-1.5">
        {bars.map(bar => {
          const width = Math.min(Math.abs(bar.value) / maxAbs * 50, 50);
          const isNeg = bar.value < 0; // negative = good for CPA
          return (
            <div key={bar.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-10 text-right font-medium">{bar.label}</span>
              <div className="flex-1 h-5 relative flex items-center">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                {bar.value >= 0 ? (
                  <div
                    className="h-4 rounded-r-sm bg-destructive/60 absolute left-1/2"
                    style={{ width: `${width}%` }}
                  />
                ) : (
                  <div
                    className="h-4 rounded-l-sm bg-positive/60 absolute"
                    style={{ width: `${width}%`, right: '50%' }}
                  />
                )}
              </div>
              <span className={`text-[10px] font-mono w-14 text-right font-bold ${isNeg ? 'text-positive' : bar.value > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {bar.value > 0 ? '+' : ''}{bar.value.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[9px] text-muted-foreground text-center">Verde = reduz CPA · Vermelho = aumenta CPA</p>
    </div>
  );
}

// ── Decision Matrix 2×2 ──────────────────────────────

function DecisionMatrix2x2({
  rows,
  leadQualityByCampaign,
}: {
  rows: any[];
  leadQualityByCampaign: Record<string, { taxa_atendimento: number }>;
}) {
  const hasLeadData = Object.keys(leadQualityByCampaign).length > 0;
  const yLabel = hasLeadData ? 'Taxa Atendimento' : 'LPV Rate';
  const ctrThreshold = 3.5;
  const yThreshold = hasLeadData ? 0.5 : 0.75;

  const points = rows.map(row => {
    const ctr = row.metrics.ctr_link || 0;
    const lq = leadQualityByCampaign[row.key];
    const yVal = hasLeadData && lq ? lq.taxa_atendimento : (row.metrics.lpv_rate || safe(row.metrics.landing_page_views, row.metrics.link_clicks));
    const spend = row.metrics.spend_brl || 0;
    return { name: row.name, key: row.key, ctr, yVal, yPct: yVal * 100, spend };
  });

  const quadrants = {
    topLeft:  { label: '🔶 Revisar Criativo', desc: 'O lead qualificado chega, mas o anúncio não ganha o feed. Teste novos hooks e formatos. Não mexa no público.', class: 'bg-warning/8 border-warning/20' },
    topRight: { label: '🟢 Escalar', desc: 'Criativo atrai, público tem intenção. Aumente budget 20-30%/semana monitorando frequência.', class: 'bg-positive/8 border-positive/20' },
    botLeft:  { label: '🔴 Pausar', desc: 'Problema duplo: criativo fraco e público errado. Pausar e repensar antes de reinvestir.', class: 'bg-destructive/8 border-destructive/20' },
    botRight: { label: '🔵 Revisar Público', desc: 'Criativo performa bem, mas público não tem intenção real. Adicione qualificadores na segmentação.', class: 'bg-primary/8 border-primary/20' },
  };

  const getPointColor = (p: typeof points[0]) => {
    if (p.ctr >= ctrThreshold && p.yVal >= yThreshold) return 'hsl(var(--positive))';
    if (p.ctr < ctrThreshold && p.yVal >= yThreshold) return 'hsl(var(--warning))';
    if (p.ctr >= ctrThreshold && p.yVal < yThreshold) return 'hsl(var(--primary))';
    return 'hsl(var(--destructive))';
  };

  const maxSpend = Math.max(...points.map(p => p.spend), 1);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="glass-panel p-2 text-[10px] space-y-0.5 max-w-[200px]">
        <p className="font-semibold text-foreground truncate">{d.name}</p>
        <p className="text-muted-foreground">CTR: {d.ctr.toFixed(2)}%</p>
        <p className="text-muted-foreground">{yLabel}: {d.yPct.toFixed(0)}%</p>
        <p className="text-muted-foreground">Spend: R${d.spend.toFixed(0)}</p>
      </div>
    );
  };

  return (
    <div className="glass-panel p-4 space-y-3">
      <div>
        <h3 className="text-xs font-semibold text-foreground">Matriz de Decisão</h3>
        <p className="text-[10px] text-muted-foreground">CTR Link × {yLabel} — limiares: {ctrThreshold}% / {(yThreshold * 100).toFixed(0)}%</p>
        {!hasLeadData && (
          <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Usando LPV Rate como proxy — importe dados de qualidade para precisão real.
          </p>
        )}
      </div>

      {/* Scatter Plot */}
      {points.length > 0 && (
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 15, bottom: 20, left: 5 }}>
              <XAxis
                type="number"
                dataKey="ctr"
                name="CTR"
                unit="%"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                label={{ value: 'CTR Link %', position: 'insideBottom', offset: -10, fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                type="number"
                dataKey="yPct"
                name={yLabel}
                unit="%"
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                label={{ value: yLabel + ' %', angle: -90, position: 'insideLeft', offset: 10, fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              />
              <ZAxis type="number" dataKey="spend" range={[40, 200]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                x={ctrThreshold}
                stroke="hsl(var(--border))"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <ReferenceLine
                y={yThreshold * 100}
                stroke="hsl(var(--border))"
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              <Scatter data={points} isAnimationActive={false}>
                {points.map((p, i) => (
                  <Cell key={i} fill={getPointColor(p)} fillOpacity={0.85} stroke={getPointColor(p)} strokeWidth={1} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <p className="text-[9px] text-muted-foreground text-center -mt-1">Tamanho do ponto = investimento relativo</p>
        </div>
      )}

      {/* Quadrant Grid */}
      <div className="grid grid-cols-[100px_1fr_1fr] gap-px text-[10px] font-bold text-muted-foreground">
        <div />
        <div className="text-center p-1">CTR baixo (&lt;{ctrThreshold}%)</div>
        <div className="text-center p-1">CTR alto (≥{ctrThreshold}%)</div>
      </div>

      <div className="grid grid-cols-[100px_1fr_1fr] gap-px">
        <div className="flex items-center text-[10px] font-bold text-muted-foreground pr-2 text-right leading-tight">
          {yLabel} alto (≥{(yThreshold * 100).toFixed(0)}%)
        </div>
        <div className={`p-3 rounded-tl-lg space-y-1 ${quadrants.topLeft.class}`}>
          <p className="text-[10px] font-bold text-foreground">{quadrants.topLeft.label}</p>
          <p className="text-[9px] text-muted-foreground leading-snug">{quadrants.topLeft.desc}</p>
          <div className="space-y-0.5 mt-1">
            {points.filter(p => p.ctr < ctrThreshold && p.yVal >= yThreshold).map(p => (
              <p key={p.key} className="text-[10px] font-mono text-foreground truncate" title={p.name}>
                • {p.name.slice(0, 22)} <span className="text-muted-foreground">({p.ctr.toFixed(1)}% / {p.yPct.toFixed(0)}%)</span>
              </p>
            ))}
          </div>
        </div>
        <div className={`p-3 rounded-tr-lg space-y-1 ${quadrants.topRight.class}`}>
          <p className="text-[10px] font-bold text-foreground">{quadrants.topRight.label}</p>
          <p className="text-[9px] text-muted-foreground leading-snug">{quadrants.topRight.desc}</p>
          <div className="space-y-0.5 mt-1">
            {points.filter(p => p.ctr >= ctrThreshold && p.yVal >= yThreshold).map(p => (
              <p key={p.key} className="text-[10px] font-mono text-foreground truncate" title={p.name}>
                • {p.name.slice(0, 22)} <span className="text-muted-foreground">({p.ctr.toFixed(1)}% / {p.yPct.toFixed(0)}%)</span>
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[100px_1fr_1fr] gap-px">
        <div className="flex items-center text-[10px] font-bold text-muted-foreground pr-2 text-right leading-tight">
          {yLabel} baixo (&lt;{(yThreshold * 100).toFixed(0)}%)
        </div>
        <div className={`p-3 rounded-bl-lg space-y-1 ${quadrants.botLeft.class}`}>
          <p className="text-[10px] font-bold text-foreground">{quadrants.botLeft.label}</p>
          <p className="text-[9px] text-muted-foreground leading-snug">{quadrants.botLeft.desc}</p>
          <div className="space-y-0.5 mt-1">
            {points.filter(p => p.ctr < ctrThreshold && p.yVal < yThreshold).map(p => (
              <p key={p.key} className="text-[10px] font-mono text-foreground truncate" title={p.name}>
                • {p.name.slice(0, 22)} <span className="text-muted-foreground">({p.ctr.toFixed(1)}% / {p.yPct.toFixed(0)}%)</span>
              </p>
            ))}
          </div>
        </div>
        <div className={`p-3 rounded-br-lg space-y-1 ${quadrants.botRight.class}`}>
          <p className="text-[10px] font-bold text-foreground">{quadrants.botRight.label}</p>
          <p className="text-[9px] text-muted-foreground leading-snug">{quadrants.botRight.desc}</p>
          <div className="space-y-0.5 mt-1">
            {points.filter(p => p.ctr >= ctrThreshold && p.yVal < yThreshold).map(p => (
              <p key={p.key} className="text-[10px] font-mono text-foreground truncate" title={p.name}>
                • {p.name.slice(0, 22)} <span className="text-muted-foreground">({p.ctr.toFixed(1)}% / {p.yPct.toFixed(0)}%)</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main View ────────────────────────────────────────

export default function ExecutiveView() {
  const { state } = useAppState();
  const { current: currentRecords, previous: previousRecords } = useFilteredRecords();

  const data = useMemo(() => {
    if (currentRecords.length === 0) return null;
    const currentMetrics = aggregateMetrics(currentRecords);
    const previousMetrics = previousRecords.length > 0 ? aggregateMetrics(previousRecords) : null;
    const delta = computeDeltas(currentMetrics, previousMetrics);

    const allDates = [...new Set(state.records.map(r => r.period_start))].sort().slice(-14);
    const sparkData = allDates.map(d => {
      const recs = state.records.filter(r => r.period_start === d);
      const agg = aggregateMetrics(recs);
      const dateObj = new Date(d + 'T00:00:00');
      return {
        period: dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        cost_per_result: agg.cost_per_result,
        results: agg.results,
        spend_brl: agg.spend_brl,
      };
    });

    const rows = groupByLevel(currentRecords, previousRecords, 'campaign', '', false);
    const verdicts = rows.map(row => ({
      row,
      verdict: computeVerdict(row, currentMetrics),
    }));

    const periodLabel = state.dateFrom && state.dateTo ? getDateRangeLabel(state.dateFrom, state.dateTo) : '';
    let summary = `Investimento de ${formatCurrency(currentMetrics.spend_brl)} gerou ${formatNumber(currentMetrics.results)} resultados a ${formatCurrency(currentMetrics.cost_per_result)}/resultado.`;
    if (previousMetrics) {
      const cpaDelta = ((currentMetrics.cost_per_result - previousMetrics.cost_per_result) / (previousMetrics.cost_per_result || 1)) * 100;
      const resultsDelta = ((currentMetrics.results - previousMetrics.results) / (previousMetrics.results || 1)) * 100;
      const trend = cpaDelta < -5 ? 'melhorou' : cpaDelta > 5 ? 'piorou' : 'estável';
      summary += ` Performance ${trend} — CPA ${cpaDelta > 0 ? '+' : ''}${cpaDelta.toFixed(1)}%, resultados ${resultsDelta > 0 ? '+' : ''}${resultsDelta.toFixed(0)}%.`;
    }

    return { currentMetrics, previousMetrics, delta, sparkData, verdicts, summary, rows };
  }, [currentRecords, previousRecords, state.records, state.dateFrom, state.dateTo]);

  // Lead quality aggregated by campaign
  const leadQualityByCampaign = useMemo(() => {
    const map: Record<string, { taxa_atendimento: number; leads_total: number; leads_atendidos: number; contratos_fechados: number; receita_brl: number; spend: number }> = {};
    for (const lq of state.leadQuality) {
      const ck = lq.campaign_key;
      if (!map[ck]) map[ck] = { taxa_atendimento: 0, leads_total: 0, leads_atendidos: 0, contratos_fechados: 0, receita_brl: 0, spend: 0 };
      map[ck].leads_total += lq.leads_total;
      map[ck].leads_atendidos += lq.leads_atendidos;
      map[ck].contratos_fechados += lq.contratos_fechados;
      map[ck].receita_brl += lq.receita_brl;
    }
    // Compute spend per campaign
    for (const r of currentRecords) {
      if (r.campaign_key && map[r.campaign_key]) {
        map[r.campaign_key].spend += r.spend_brl;
      }
    }
    // Compute rates
    for (const k of Object.keys(map)) {
      map[k].taxa_atendimento = safe(map[k].leads_atendidos, map[k].leads_total);
    }
    return map;
  }, [state.leadQuality, currentRecords]);

  // ROAS Real totals
  const roasReal = useMemo(() => {
    if (state.leadQuality.length === 0) return null;
    const totalReceita = state.leadQuality.reduce((s, r) => s + r.receita_brl, 0);
    const totalSpend = Object.values(leadQualityByCampaign).reduce((s, v) => s + v.spend, 0);
    if (totalSpend === 0) return null;
    return { roas: totalReceita / totalSpend, receita: totalReceita };
  }, [state.leadQuality, leadQualityByCampaign]);

  if (!data) return <p className="text-muted-foreground text-center py-8 text-sm">Selecione um período</p>;

  const heroKPIs = [
    {
      label: 'Custo / Resultado',
      value: formatCurrency(data.currentMetrics.cost_per_result),
      delta: data.delta.deltas['cost_per_result'],
      inverted: true,
      sparkKey: 'cost_per_result',
      color: 'hsl(var(--chart-1))',
      colorClass: '',
    },
    {
      label: 'Resultados',
      value: formatNumber(data.currentMetrics.results),
      delta: data.delta.deltas['results'],
      inverted: false,
      sparkKey: 'results',
      color: 'hsl(var(--chart-2))',
      colorClass: '',
    },
    {
      label: 'Investimento',
      value: formatCurrency(data.currentMetrics.spend_brl),
      delta: data.delta.deltas['spend_brl'],
      inverted: false,
      sparkKey: 'spend_brl',
      color: 'hsl(var(--chart-3))',
      colorClass: '',
    },
  ];

  // Add ROAS Real if lead quality data exists
  if (roasReal) {
    heroKPIs.push({
      label: 'ROAS Real',
      value: `${roasReal.roas.toFixed(1)}×`,
      delta: null as any,
      inverted: false,
      sparkKey: '',
      color: '',
      colorClass: roasReal.roas >= 3 ? 'text-positive' : roasReal.roas >= 1.5 ? 'text-warning' : 'text-destructive',
    });
  }

  return (
    <div className="space-y-4">
      {/* Auto Summary */}
      <div className="glass-panel p-4 border-l-2 border-l-primary">
        <div className="flex items-start gap-3">
          <Activity className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground/90 leading-relaxed">{data.summary}</p>
        </div>
      </div>

      {/* 1. CPA Waterfall Mini — first visual element */}
      <CPAWaterfallMini current={data.currentMetrics} previous={data.previousMetrics} />

      {/* Hero KPIs */}
      <div className={`grid grid-cols-1 gap-3 ${roasReal ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        {heroKPIs.map(kpi => {
          const isPositive = kpi.delta ? (kpi.inverted ? kpi.delta.absolute < 0 : kpi.delta.absolute > 0) : null;
          return (
            <div key={kpi.label} className="glass-panel p-4 flex items-center justify-between gap-4 group hover:border-primary/20 transition-colors">
              <div className="space-y-1.5">
                <p className="metric-label">{kpi.label}</p>
                <p className={`metric-value ${kpi.colorClass}`}>{kpi.value}</p>
                {kpi.label === 'ROAS Real' && roasReal && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    R$ {roasReal.receita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} receita
                  </p>
                )}
                {kpi.delta && kpi.delta.percent !== null && (
                  <div className="flex items-center gap-1">
                    {isPositive ? <TrendingUp className="h-3 w-3 text-positive" /> : isPositive === false ? <TrendingDown className="h-3 w-3 text-negative" /> : <Minus className="h-3 w-3 text-muted-foreground" />}
                    <span className={`text-[11px] font-mono font-medium ${isPositive ? 'text-positive' : isPositive === false ? 'text-negative' : 'text-muted-foreground'}`}>
                      {kpi.delta.percent > 0 ? '+' : ''}{kpi.delta.percent.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              {kpi.sparkKey && <Sparkline data={data.sparkData} dataKey={kpi.sparkKey} color={kpi.color} />}
            </div>
          );
        })}
      </div>

      {/* Campaign Semaphores */}
      <div className="glass-panel p-4">
        <h3 className="metric-label mb-4">Semáforo por Campanha</h3>
        <div className="space-y-2">
          {data.verdicts.map(({ row, verdict }) => {
            const lq = leadQualityByCampaign[row.key];
            const cpaContrato = lq && lq.contratos_fechados > 0 ? lq.spend / lq.contratos_fechados : null;
            const roas = lq && lq.spend > 0 ? lq.receita_brl / lq.spend : null;

            return (
              <div key={row.key} className="flex items-center gap-3 p-3 rounded-md bg-surface-2/50 hover:bg-surface-2 transition-colors border border-transparent hover:border-border/50">
                <TrafficLight verdict={verdict} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{row.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {formatCurrency(row.metrics.spend_brl)} · {formatNumber(row.metrics.results)} res · CPA {formatCurrency(row.metrics.cost_per_result)}
                  </p>
                  {lq && (
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      CPA Meta: {formatCurrency(row.metrics.cost_per_result)}
                      {cpaContrato !== null && <> → CPA Contrato: {formatCurrency(cpaContrato)}</>}
                      {roas !== null && (
                        <> → ROAS: <span className={roas >= 3 ? 'text-positive font-bold' : roas >= 1.5 ? 'text-warning font-bold' : 'text-destructive font-bold'}>{roas.toFixed(1)}×</span></>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
                  <p className={`text-lg font-bold font-mono ${verdict.color}`}>{verdict.score}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Decision Matrix 2×2 */}
      {data.rows.length > 0 && (
        <DecisionMatrix2x2
          rows={data.rows}
          leadQualityByCampaign={leadQualityByCampaign}
        />
      )}

      {/* Verdict Reasons */}
      {data.verdicts.some(v => v.verdict.reasons.length > 0) && (
        <div className="glass-panel p-4">
          <h3 className="metric-label mb-3">Razões dos Veredictos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.verdicts.filter(v => v.verdict.reasons.length > 0).map(({ row, verdict }) => (
              <div key={row.key} className="space-y-1 p-2.5 rounded-md bg-surface-2/30">
                <p className="text-[11px] font-medium text-foreground">{row.name}</p>
                <ul className="space-y-0.5">
                  {verdict.reasons.map((r, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">›</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
