import { useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { useCrossFilter } from '@/lib/crossFilter';
import {
  aggregateMetrics,
  computeDeltas,
  identifyDrivers,
  METRIC_DEFS,
  getDateRangeLabel,
} from '@/lib/calculations';
import KPICard from './KPICard';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';

export default function OverviewCards() {
  const { state } = useAppState();
  const { current: rawCurrent, previous: rawPrevious } = useFilteredRecords();
  const { filter: crossFilter } = useCrossFilter();

  const current = useMemo(() => {
    if (!crossFilter.key || !crossFilter.level) return rawCurrent;
    return rawCurrent.filter(r => {
      if (crossFilter.level === 'campaign') return (r.campaign_key || 'sem-campanha') === crossFilter.key;
      if (crossFilter.level === 'adset') return (r.adset_key || 'sem-conjunto') === crossFilter.key;
      if (crossFilter.level === 'ad') return r.ad_key === crossFilter.key;
      return true;
    });
  }, [rawCurrent, crossFilter]);

  const previous = useMemo(() => {
    if (!crossFilter.key || !crossFilter.level) return rawPrevious;
    return rawPrevious.filter(r => {
      if (crossFilter.level === 'campaign') return (r.campaign_key || 'sem-campanha') === crossFilter.key;
      if (crossFilter.level === 'adset') return (r.adset_key || 'sem-conjunto') === crossFilter.key;
      if (crossFilter.level === 'ad') return r.ad_key === crossFilter.key;
      return true;
    });
  }, [rawPrevious, crossFilter]);

  const data = useMemo(() => {
    if (current.length === 0) return null;
    const currentMetrics = aggregateMetrics(current);
    const previousMetrics = previous.length > 0 ? aggregateMetrics(previous) : null;
    const delta = computeDeltas(currentMetrics, previousMetrics);
    const drivers = identifyDrivers(delta, 5);
    return { currentMetrics, delta, drivers };
  }, [current, previous]);

  if (!data) return null;

  const funnel = state.funnelData.find(f => f.period_key === state.dateFrom);
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

  const compLabel = state.comparisonFrom && state.comparisonTo
    ? getDateRangeLabel(state.comparisonFrom, state.comparisonTo)
    : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {metricDefs.map((def, i) => {
          const value = def.key === 'roas' ? roas : (data.currentMetrics as any)[def.key] ?? 0;
          const delta = data.delta.deltas[def.key] || null;
          const targets = state.targets.find(t => t.period_key === state.dateFrom);
          const target = targets ? (targets as any)[def.key] : undefined;
          return (
            <div key={def.key} style={{ animationDelay: `${i * 40}ms` }}>
              <KPICard def={def} value={value} delta={delta} target={target} />
            </div>
          );
        })}
      </div>

      {data.drivers.length > 0 && (
        <div className="bg-card border border-border rounded-meta-card p-4 shadow-meta-subtle">
          <h3 className="text-meta-body font-semibold text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" strokeWidth={1.5} />
            O que mudou?
            {compLabel && (
              <span className="text-meta-caption text-muted-foreground font-normal">
                vs {compLabel}
              </span>
            )}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.drivers.map(driver => {
              const def = METRIC_DEFS.find(m => m.key === driver.key);
              return (
                <div key={driver.key} className="flex items-center gap-3 p-2.5 rounded-meta-btn bg-secondary hover:bg-secondary/80 transition-colors">
                  {driver.impact === 'positive' ? (
                    <TrendingUp className="h-4 w-4 text-positive flex-shrink-0" strokeWidth={1.5} />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-negative flex-shrink-0" strokeWidth={1.5} />
                  )}
                  <div className="min-w-0">
                    <p className="text-meta-caption font-medium text-foreground truncate">{driver.label}</p>
                    <p className={`text-meta-caption ${driver.impact === 'positive' ? 'text-positive' : 'text-negative'}`}>
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
