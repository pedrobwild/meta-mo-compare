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
import { TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

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

    return { currentMetrics, delta, sparkData, verdicts, summary };
  }, [currentRecords, previousRecords, state.records, state.dateFrom, state.dateTo]);

  if (!data) return <p className="text-muted-foreground text-center py-8 text-sm">Selecione um período</p>;

  const heroKPIs = [
    {
      label: 'Custo / Resultado',
      value: formatCurrency(data.currentMetrics.cost_per_result),
      delta: data.delta.deltas['cost_per_result'],
      inverted: true,
      sparkKey: 'cost_per_result',
      color: 'hsl(var(--chart-1))',
    },
    {
      label: 'Resultados',
      value: formatNumber(data.currentMetrics.results),
      delta: data.delta.deltas['results'],
      inverted: false,
      sparkKey: 'results',
      color: 'hsl(var(--chart-2))',
    },
    {
      label: 'Investimento',
      value: formatCurrency(data.currentMetrics.spend_brl),
      delta: data.delta.deltas['spend_brl'],
      inverted: false,
      sparkKey: 'spend_brl',
      color: 'hsl(var(--chart-3))',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Auto Summary */}
      <div className="glass-panel p-4 border-l-2 border-l-primary">
        <div className="flex items-start gap-3">
          <Activity className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-foreground/90 leading-relaxed">{data.summary}</p>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {heroKPIs.map(kpi => {
          const isPositive = kpi.delta ? (kpi.inverted ? kpi.delta.absolute < 0 : kpi.delta.absolute > 0) : null;
          return (
            <div key={kpi.label} className="glass-panel p-4 flex items-center justify-between gap-4 group hover:border-primary/20 transition-colors">
              <div className="space-y-1.5">
                <p className="metric-label">{kpi.label}</p>
                <p className="metric-value">{kpi.value}</p>
                {kpi.delta && kpi.delta.percent !== null && (
                  <div className="flex items-center gap-1">
                    {isPositive ? <TrendingUp className="h-3 w-3 text-positive" /> : isPositive === false ? <TrendingDown className="h-3 w-3 text-negative" /> : <Minus className="h-3 w-3 text-muted-foreground" />}
                    <span className={`text-[11px] font-mono font-medium ${isPositive ? 'text-positive' : isPositive === false ? 'text-negative' : 'text-muted-foreground'}`}>
                      {kpi.delta.percent > 0 ? '+' : ''}{kpi.delta.percent.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              <Sparkline data={data.sparkData} dataKey={kpi.sparkKey} color={kpi.color} />
            </div>
          );
        })}
      </div>

      {/* Campaign Semaphores */}
      <div className="glass-panel p-4">
        <h3 className="metric-label mb-4">Semáforo por Campanha</h3>
        <div className="space-y-2">
          {data.verdicts.map(({ row, verdict }) => (
            <div key={row.key} className="flex items-center gap-3 p-3 rounded-md bg-surface-2/50 hover:bg-surface-2 transition-colors border border-transparent hover:border-border/50">
              <TrafficLight verdict={verdict} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{row.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {formatCurrency(row.metrics.spend_brl)} · {formatNumber(row.metrics.results)} res · CPA {formatCurrency(row.metrics.cost_per_result)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
                <p className={`text-lg font-bold font-mono ${verdict.color}`}>{verdict.score}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

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
