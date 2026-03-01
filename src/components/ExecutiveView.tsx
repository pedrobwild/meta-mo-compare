import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import {
  aggregateMetrics,
  computeDeltas,
  filterByPeriodWithFallback,
  groupByLevel,
  getAvailablePeriods,
  getPeriodLabel,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/calculations';
import { computeVerdict, type VerdictResult } from '@/lib/insights/verdicts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
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
  const bg = verdict.verdict === 'scale' ? 'bg-positive/20 border-positive/40'
    : verdict.verdict === 'keep' ? 'bg-primary/20 border-primary/40'
    : verdict.verdict === 'test_variation' ? 'bg-warning/20 border-warning/40'
    : verdict.verdict === 'watch' ? 'bg-warning/20 border-warning/40'
    : 'bg-negative/20 border-negative/40';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${bg} ${verdict.color}`}>
      {verdict.emoji} {verdict.label}
    </span>
  );
}

export default function ExecutiveView() {
  const { state } = useAppState();

  const data = useMemo(() => {
    if (!state.selectedPeriodKey) return null;
    const current = filterByPeriodWithFallback(state.records, state.selectedPeriodKey, state.truthSource);
    const previous = state.comparisonPeriodKey
      ? filterByPeriodWithFallback(state.records, state.comparisonPeriodKey, state.truthSource)
      : [];
    const currentMetrics = aggregateMetrics(current);
    const previousMetrics = previous.length > 0 ? aggregateMetrics(previous) : null;
    const delta = computeDeltas(currentMetrics, previousMetrics);

    // Sparkline data (last 8 periods)
    const periods = getAvailablePeriods(state.records, state.selectedGranularity).slice(0, 8).reverse();
    const sparkData = periods.map(p => {
      const recs = filterByPeriodWithFallback(state.records, p, state.truthSource);
      const agg = aggregateMetrics(recs);
      return { period: getPeriodLabel(p, state.selectedGranularity), cost_per_result: agg.cost_per_result, results: agg.results, spend_brl: agg.spend_brl };
    });

    // Campaign verdicts
    const rows = groupByLevel(current, previous, 'campaign', '', false);
    const verdicts = rows.map(row => ({
      row,
      verdict: computeVerdict(row, currentMetrics),
    }));

    // Auto summary
    const periodLabel = getPeriodLabel(state.selectedPeriodKey, state.selectedGranularity);
    let summary = `Em ${periodLabel}, investimos ${formatCurrency(currentMetrics.spend_brl)} e trouxemos ${formatNumber(currentMetrics.results)} resultados a ${formatCurrency(currentMetrics.cost_per_result)} cada.`;
    if (previousMetrics) {
      const spendDelta = ((currentMetrics.spend_brl - previousMetrics.spend_brl) / (previousMetrics.spend_brl || 1)) * 100;
      const resultsDelta = ((currentMetrics.results - previousMetrics.results) / (previousMetrics.results || 1)) * 100;
      const cpaDelta = ((currentMetrics.cost_per_result - previousMetrics.cost_per_result) / (previousMetrics.cost_per_result || 1)) * 100;
      const trend = cpaDelta < -5 ? 'melhorou' : cpaDelta > 5 ? 'piorou' : 'se manteve estável';
      summary += ` Performance ${trend} — CPA ${cpaDelta > 0 ? '+' : ''}${cpaDelta.toFixed(1)}%, resultados ${resultsDelta > 0 ? '+' : ''}${resultsDelta.toFixed(0)}%.`;
    }

    return { currentMetrics, delta, sparkData, verdicts, summary };
  }, [state.records, state.selectedPeriodKey, state.comparisonPeriodKey, state.truthSource, state.selectedGranularity]);

  if (!data) return <p className="text-muted-foreground text-center py-8">Selecione um período</p>;

  const heroKPIs = [
    {
      label: 'Custo/Resultado',
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
    <div className="space-y-6">
      {/* Auto Summary */}
      <div className="glass-card p-5 border-l-4 border-l-primary">
        <p className="text-sm text-foreground leading-relaxed">{data.summary}</p>
      </div>

      {/* Hero KPIs with sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {heroKPIs.map(kpi => {
          const isPositive = kpi.delta ? (kpi.inverted ? kpi.delta.absolute < 0 : kpi.delta.absolute > 0) : null;
          return (
            <div key={kpi.label} className="glass-card p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
                {kpi.delta && kpi.delta.percent !== null && (
                  <div className="flex items-center gap-1">
                    {isPositive ? <TrendingUp className="h-3.5 w-3.5 text-positive" /> : isPositive === false ? <TrendingDown className="h-3.5 w-3.5 text-negative" /> : <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className={`text-xs font-medium ${isPositive ? 'text-positive' : isPositive === false ? 'text-negative' : 'text-muted-foreground'}`}>
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
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Semáforo por Campanha</h3>
        <div className="space-y-3">
          {data.verdicts.map(({ row, verdict }) => (
            <div key={row.key} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
              <TrafficLight verdict={verdict} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(row.metrics.spend_brl)} • {formatNumber(row.metrics.results)} resultados • CPA {formatCurrency(row.metrics.cost_per_result)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Score</p>
                <p className={`text-lg font-bold ${verdict.color}`}>{verdict.score}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Verdicts Summary */}
      {data.verdicts.some(v => v.verdict.reasons.length > 0) && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-3">Razões dos Veredictos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.verdicts.filter(v => v.verdict.reasons.length > 0).map(({ row, verdict }) => (
              <div key={row.key} className="space-y-1">
                <p className="text-xs font-medium text-foreground">{row.name}</p>
                <ul className="space-y-0.5">
                  {verdict.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {r}</li>
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
