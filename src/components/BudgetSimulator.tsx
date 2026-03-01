import { useMemo, useState } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  groupByLevel,
  formatCurrency,
  formatNumber,
} from '@/lib/calculations';
import { computeVerdict } from '@/lib/insights/verdicts';
import { Calculator, ArrowRight } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

export default function BudgetSimulator() {
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();
  const [budgetChange, setBudgetChange] = useState(0);

  const simulation = useMemo(() => {
    if (current.length === 0) return null;
    const metrics = aggregateMetrics(current);
    const rows = groupByLevel(current, previous, state.analysisLevel, '', false);

    if (rows.length === 0) return null;

    const categorized = rows.map(row => ({
      row,
      verdict: computeVerdict(row, metrics),
    }));

    const scalable = categorized.filter(c => c.verdict.verdict === 'scale');
    const pausable = categorized.filter(c => c.verdict.verdict === 'pause');

    const currentSpend = metrics.spend_brl;
    const newSpend = currentSpend * (1 + budgetChange / 100);
    const delta = newSpend - currentSpend;

    const scalableSpend = scalable.reduce((s, c) => s + c.row.metrics.spend_brl, 0);
    const pausableSpend = pausable.reduce((s, c) => s + c.row.metrics.spend_brl, 0);

    const currentCPA = metrics.cost_per_result;
    let projectedCPA: number;
    if (budgetChange > 0) {
      projectedCPA = currentCPA * (1 + (budgetChange / 100) * 0.15);
    } else {
      const cutFromPausable = Math.min(Math.abs(delta), pausableSpend);
      const efficiency = cutFromPausable / Math.abs(delta || 1);
      projectedCPA = currentCPA * (1 - efficiency * 0.1);
    }

    const projectedResults = newSpend / projectedCPA;

    return {
      currentSpend,
      currentCPA,
      currentResults: metrics.results,
      newSpend,
      projectedCPA,
      projectedResults,
      scalableCount: scalable.length,
      pausableCount: pausable.length,
      scalableSpend,
      pausableSpend,
    };
  }, [current, previous, state.analysisLevel, budgetChange]);

  if (!simulation) return null;

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        Simulador de Budget
      </h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Ajuste de budget</span>
            <span className={`font-medium ${budgetChange > 0 ? 'text-positive' : budgetChange < 0 ? 'text-negative' : 'text-muted-foreground'}`}>
              {budgetChange > 0 ? '+' : ''}{budgetChange}%
            </span>
          </div>
          <Slider
            value={[budgetChange]}
            onValueChange={v => setBudgetChange(v[0])}
            min={-50}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>-50%</span>
            <span>0%</span>
            <span>+100%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Investimento', current: formatCurrency(simulation.currentSpend), projected: formatCurrency(simulation.newSpend) },
            { label: 'CPA Estimado', current: formatCurrency(simulation.currentCPA), projected: formatCurrency(simulation.projectedCPA) },
            { label: 'Resultados', current: formatNumber(simulation.currentResults), projected: formatNumber(simulation.projectedResults) },
          ].map(item => (
            <div key={item.label} className="text-center p-3 rounded-lg bg-secondary/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{item.label}</p>
              <div className="flex items-center justify-center gap-1 text-xs">
                <span className="text-muted-foreground">{item.current}</span>
                <ArrowRight className="h-3 w-3 text-primary" />
                <span className="font-medium text-foreground">{item.projected}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          {simulation.scalableCount} item(ns) escaláveis • {simulation.pausableCount} item(ns) para pausar
        </p>
      </div>
    </div>
  );
}
