import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import {
  aggregateMetrics,
  computeDeltas,
  filterByPeriodWithFallback,
  identifyDrivers,
  METRIC_DEFS,
  getPeriodLabel,
} from '@/lib/calculations';
import KPICard from './KPICard';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';

export default function OverviewCards() {
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
    const drivers = identifyDrivers(delta, 5);

    return { currentMetrics, delta, drivers };
  }, [state.records, state.selectedPeriodKey, state.comparisonPeriodKey, state.truthSource]);

  if (!data) return null;

  const targets = state.targets.find(t => t.period_key === state.selectedPeriodKey);

  const funnel = state.funnelData.find(f => f.period_key === state.selectedPeriodKey);
  const roas = funnel && data.currentMetrics.spend_brl > 0
    ? funnel.receita / data.currentMetrics.spend_brl : 0;

  const metricDefs = [...METRIC_DEFS];
  if (funnel) {
    metricDefs.push({
      key: 'roas',
      label: 'ROAS',
      format: (v: number) => v.toFixed(2) + 'x',
    });
  }

  return (
    <div className="space-y-4">
      {/* KPI Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {metricDefs.map((def, i) => {
          const value = def.key === 'roas' ? roas : (data.currentMetrics as any)[def.key] ?? 0;
          const delta = data.delta.deltas[def.key] || null;
          const target = targets ? (targets as any)[def.key] : undefined;
          return (
            <div key={def.key} style={{ animationDelay: `${i * 50}ms` }}>
              <KPICard def={def} value={value} delta={delta} target={target} />
            </div>
          );
        })}
      </div>

      {/* "O que mudou?" drivers block */}
      {data.drivers.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            O que mudou?
            {state.comparisonPeriodKey && (
              <span className="text-xs text-muted-foreground font-normal">
                vs {getPeriodLabel(state.comparisonPeriodKey, state.selectedGranularity)}
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.drivers.map(driver => {
              const def = METRIC_DEFS.find(m => m.key === driver.key);
              return (
                <div key={driver.key} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                  {driver.impact === 'positive' ? (
                    <TrendingUp className="h-4 w-4 text-positive flex-shrink-0" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-negative flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{driver.label}</p>
                    <p className={`text-xs ${driver.impact === 'positive' ? 'text-positive' : 'text-negative'}`}>
                      {driver.percentChange > 0 ? '+' : ''}{driver.percentChange.toFixed(1)}%
                      {def && (
                        <span className="text-muted-foreground ml-1">
                          ({def.format(driver.previous)} → {def.format(driver.current)})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
