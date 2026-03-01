import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import { filterByPeriodWithFallback, groupByLevel } from '@/lib/calculations';
import { generateComparisons, type AdComparison } from '@/lib/insights/comparisons';
import { ArrowRight, Trophy, Minus } from 'lucide-react';

export default function ComparisonCards() {
  const { state } = useAppState();

  const comparisons = useMemo(() => {
    if (!state.selectedPeriodKey) return [];
    const current = filterByPeriodWithFallback(state.records, state.selectedPeriodKey, state.truthSource);
    const previous = state.comparisonPeriodKey
      ? filterByPeriodWithFallback(state.records, state.comparisonPeriodKey, state.truthSource)
      : [];
    const rows = groupByLevel(current, previous, state.analysisLevel, '', false);
    return generateComparisons(rows);
  }, [state.records, state.selectedPeriodKey, state.comparisonPeriodKey, state.truthSource, state.analysisLevel]);

  if (comparisons.length === 0) return null;

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-warning" />
        Comparações Diretas
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {comparisons.map(comp => (
          <ComparisonCard key={comp.id} comparison={comp} />
        ))}
      </div>
    </div>
  );
}

function ComparisonCard({ comparison: c }: { comparison: AdComparison }) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground">{c.title}</h4>
        <span className="text-[10px] text-muted-foreground">{c.description}</span>
      </div>

      {/* Names */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`font-medium ${c.winner === 'A' ? 'text-positive' : 'text-foreground'} truncate max-w-[40%]`}>
          {c.winner === 'A' && '👑 '}{c.adA.name}
        </span>
        <span className="text-muted-foreground">vs</span>
        <span className={`font-medium ${c.winner === 'B' ? 'text-positive' : 'text-foreground'} truncate max-w-[40%]`}>
          {c.winner === 'B' && '👑 '}{c.adB.name}
        </span>
      </div>

      {/* Metrics comparison */}
      <div className="space-y-1.5">
        {c.metrics.map(m => (
          <div key={m.label} className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-14 flex-shrink-0">{m.label}</span>
            <span className={`flex-1 text-right ${m.betterIs === 'A' ? 'text-positive font-medium' : 'text-foreground'}`}>
              {m.valueA}
            </span>
            <Minus className="h-3 w-3 text-muted-foreground/40" />
            <span className={`flex-1 ${m.betterIs === 'B' ? 'text-positive font-medium' : 'text-foreground'}`}>
              {m.valueB}
            </span>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div className="bg-primary/10 rounded-md px-3 py-2">
        <p className="text-[11px] text-primary flex items-start gap-1.5">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          {c.recommendation}
        </p>
      </div>
    </div>
  );
}
