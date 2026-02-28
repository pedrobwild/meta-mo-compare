import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import {
  aggregateMetrics,
  computeDeltas,
  filterByTruthSourceWithFallback,
  METRIC_DEFS,
} from '@/lib/calculations';
import KPICard from './KPICard';

export default function OverviewCards() {
  const { state } = useAppState();

  const data = useMemo(() => {
    if (!state.selectedMonth) return null;
    const current = filterByTruthSourceWithFallback(state.records, state.selectedMonth, state.truthSource);
    const previous = state.comparisonMonth
      ? filterByTruthSourceWithFallback(state.records, state.comparisonMonth, state.truthSource)
      : [];

    const currentMetrics = aggregateMetrics(current);
    const previousMetrics = previous.length > 0 ? aggregateMetrics(previous) : null;
    const delta = computeDeltas(currentMetrics, previousMetrics);

    return { currentMetrics, delta };
  }, [state.records, state.selectedMonth, state.comparisonMonth, state.truthSource]);

  if (!data) return null;

  const targets = state.targets.find(t => t.month_key === state.selectedMonth);

  // Add ROAS if funnel data exists
  const funnel = state.funnelData.find(f => f.month_key === state.selectedMonth);
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
  );
}
