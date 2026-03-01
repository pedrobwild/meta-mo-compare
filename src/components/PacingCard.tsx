import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import {
  aggregateMetrics,
  filterByPeriodWithFallback,
  getAvailablePeriods,
  formatCurrency,
  formatNumber,
} from '@/lib/calculations';
import { TrendingUp, Target, Calendar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function PacingCard() {
  const { state } = useAppState();

  const pacing = useMemo(() => {
    if (!state.selectedPeriodKey) return null;

    // Get all periods for current granularity
    const periods = getAvailablePeriods(state.records, state.selectedGranularity);
    if (periods.length < 2) return null;

    // Find which month we're in based on selected period
    const monthMatch = state.selectedPeriodKey.match(/^(\d{4})/);
    if (!monthMatch) return null;

    // Get all periods in same year
    const yearPeriods = periods.filter(p => p.startsWith(monthMatch[1]));

    // Get month targets
    const targets = state.targets.find(t => t.period_key === state.selectedPeriodKey);

    // Calculate current totals across all loaded periods
    let totalSpend = 0;
    let totalResults = 0;
    let periodsCount = 0;

    for (const p of yearPeriods) {
      const recs = filterByPeriodWithFallback(state.records, p, state.truthSource);
      if (recs.length > 0) {
        const agg = aggregateMetrics(recs);
        totalSpend += agg.spend_brl;
        totalResults += agg.results;
        periodsCount++;
      }
    }

    if (periodsCount === 0) return null;

    // Estimate monthly pacing (assume 4 weeks per month for weekly data)
    const weeksInMonth = state.selectedGranularity === 'week' ? 4 : 30;
    const avgPerPeriod = {
      spend: totalSpend / periodsCount,
      results: totalResults / periodsCount,
    };

    const projectedSpend = avgPerPeriod.spend * weeksInMonth;
    const projectedResults = avgPerPeriod.results * weeksInMonth;

    const spendTarget = targets?.spend;
    const resultsTarget = targets?.results;

    return {
      periodsLoaded: periodsCount,
      totalSpend,
      totalResults,
      avgSpendPerPeriod: avgPerPeriod.spend,
      avgResultsPerPeriod: avgPerPeriod.results,
      projectedSpend,
      projectedResults,
      spendTarget,
      resultsTarget,
      spendPacing: spendTarget ? (totalSpend / spendTarget) * 100 : null,
      resultsPacing: resultsTarget ? (totalResults / resultsTarget) * 100 : null,
    };
  }, [state.records, state.selectedPeriodKey, state.selectedGranularity, state.truthSource, state.targets]);

  if (!pacing) return null;

  const items = [
    {
      label: 'Investimento',
      current: formatCurrency(pacing.totalSpend),
      projected: formatCurrency(pacing.projectedSpend),
      target: pacing.spendTarget ? formatCurrency(pacing.spendTarget) : null,
      pacing: pacing.spendPacing,
      avg: formatCurrency(pacing.avgSpendPerPeriod) + '/período',
    },
    {
      label: 'Resultados',
      current: formatNumber(pacing.totalResults),
      projected: formatNumber(pacing.projectedResults),
      target: pacing.resultsTarget ? formatNumber(pacing.resultsTarget) : null,
      pacing: pacing.resultsPacing,
      avg: formatNumber(pacing.avgResultsPerPeriod, 1) + '/período',
    },
  ];

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        Projeção ({pacing.periodsLoaded} períodos carregados)
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
              <span className="text-foreground">Projeção: {item.projected}</span>
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
