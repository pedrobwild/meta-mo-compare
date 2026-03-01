import { useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  formatCurrency,
  formatNumber,
  getDateRangeLabel,
} from '@/lib/calculations';
import { TrendingUp, Target, Calendar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function PacingCard() {
  const { state } = useAppState();
  const { current } = useFilteredRecords();

  const pacing = useMemo(() => {
    if (current.length === 0 || !state.dateFrom || !state.dateTo) return null;

    // Calculate days in selected range
    const from = new Date(state.dateFrom + 'T00:00:00');
    const to = new Date(state.dateTo + 'T00:00:00');
    const selectedDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;

    const metrics = aggregateMetrics(current);
    
    // Get unique dates with data
    const datesWithData = [...new Set(current.map(r => r.period_start))].length;
    if (datesWithData === 0) return null;

    const avgPerDay = {
      spend: metrics.spend_brl / datesWithData,
      results: metrics.results / datesWithData,
    };

    // Project to 30 days
    const projectedSpend = avgPerDay.spend * 30;
    const projectedResults = avgPerDay.results * 30;

    const targets = state.targets.find(t => t.period_key === state.dateFrom);
    const spendTarget = targets?.spend;
    const resultsTarget = targets?.results;

    return {
      datesWithData,
      selectedDays,
      totalSpend: metrics.spend_brl,
      totalResults: metrics.results,
      avgSpendPerDay: avgPerDay.spend,
      avgResultsPerDay: avgPerDay.results,
      projectedSpend,
      projectedResults,
      spendTarget,
      resultsTarget,
      spendPacing: spendTarget ? (metrics.spend_brl / spendTarget) * 100 : null,
      resultsPacing: resultsTarget ? (metrics.results / resultsTarget) * 100 : null,
    };
  }, [current, state.dateFrom, state.dateTo, state.targets]);

  if (!pacing) return null;

  const items = [
    {
      label: 'Investimento',
      current: formatCurrency(pacing.totalSpend),
      projected: formatCurrency(pacing.projectedSpend),
      target: pacing.spendTarget ? formatCurrency(pacing.spendTarget) : null,
      pacing: pacing.spendPacing,
      avg: formatCurrency(pacing.avgSpendPerDay) + '/dia',
    },
    {
      label: 'Resultados',
      current: formatNumber(pacing.totalResults),
      projected: formatNumber(pacing.projectedResults),
      target: pacing.resultsTarget ? formatNumber(pacing.resultsTarget) : null,
      pacing: pacing.resultsPacing,
      avg: formatNumber(pacing.avgResultsPerDay, 1) + '/dia',
    },
  ];

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        Projeção ({pacing.datesWithData} dias com dados)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item => (
          <div key={item.label} className="space-y-2 p-3 rounded-lg bg-secondary/30">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</span>
              <span className="text-[11px] text-muted-foreground">{item.avg}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-foreground">{item.current}</span>
              <span className="text-xs text-muted-foreground">atual</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground">Projeção mensal: {item.projected}</span>
            </div>
            {item.target && item.pacing !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" /> Meta: {item.target}
                  </span>
                  <span className={item.pacing >= 90 ? 'text-positive' : item.pacing >= 70 ? 'text-warning' : 'text-negative'}>
                    {item.pacing.toFixed(0)}%
                  </span>
                </div>
                <Progress value={Math.min(100, item.pacing)} className="h-1.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
