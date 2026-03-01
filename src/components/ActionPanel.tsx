import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import {
  aggregateMetrics,
  filterByPeriodWithFallback,
  groupByLevel,
  formatCurrency,
  formatNumber,
} from '@/lib/calculations';
import { computeVerdict } from '@/lib/insights/verdicts';
import { generateInsights } from '@/lib/insights/rules';
import { computeDeltas } from '@/lib/calculations';
import { Zap, ArrowUp, Pause, RefreshCw, Eye, Scale } from 'lucide-react';

interface ActionItem {
  icon: React.ReactNode;
  action: string;
  target: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export default function ActionPanel() {
  const { state } = useAppState();

  const actions = useMemo((): ActionItem[] => {
    if (!state.selectedPeriodKey) return [];
    const current = filterByPeriodWithFallback(state.records, state.selectedPeriodKey, state.truthSource);
    const previous = state.comparisonPeriodKey
      ? filterByPeriodWithFallback(state.records, state.comparisonPeriodKey, state.truthSource)
      : [];
    const avgMetrics = aggregateMetrics(current);
    const rows = groupByLevel(current, previous, state.analysisLevel, '', false);
    const items: ActionItem[] = [];

    for (const row of rows) {
      const v = computeVerdict(row, avgMetrics);

      if (v.verdict === 'scale') {
        items.push({
          icon: <ArrowUp className="h-4 w-4" />,
          action: 'Escalar',
          target: row.name,
          reason: `Score ${v.score} — ${v.reasons[0] || 'Performance excelente'}`,
          priority: 'high',
        });
      } else if (v.verdict === 'pause') {
        items.push({
          icon: <Pause className="h-4 w-4" />,
          action: 'Pausar',
          target: row.name,
          reason: `Score ${v.score} — ${v.reasons[0] || 'Performance insuficiente'}`,
          priority: 'high',
        });
      } else if (v.verdict === 'test_variation') {
        items.push({
          icon: <RefreshCw className="h-4 w-4" />,
          action: 'Testar variação',
          target: row.name,
          reason: `Score ${v.score} — ${v.reasons[0] || 'Potencial de melhoria'}`,
          priority: 'medium',
        });
      } else if (v.verdict === 'watch') {
        items.push({
          icon: <Eye className="h-4 w-4" />,
          action: 'Observar',
          target: row.name,
          reason: `Score ${v.score} — ${v.reasons[0] || 'Aguardar mais dados'}`,
          priority: 'low',
        });
      }
    }

    // Budget reallocation suggestion
    const scalable = rows.filter(r => computeVerdict(r, avgMetrics).verdict === 'scale');
    const pausable = rows.filter(r => computeVerdict(r, avgMetrics).verdict === 'pause');
    if (scalable.length > 0 && pausable.length > 0) {
      const savedBudget = pausable.reduce((s, r) => s + r.metrics.spend_brl, 0);
      items.unshift({
        icon: <Scale className="h-4 w-4" />,
        action: 'Realocar budget',
        target: `${formatCurrency(savedBudget)} de ${pausable.length} item(ns) para ${scalable.length} item(ns)`,
        reason: `Mover budget de itens com Score baixo para itens com Score alto`,
        priority: 'high',
      });
    }

    return items;
  }, [state.records, state.selectedPeriodKey, state.comparisonPeriodKey, state.truthSource, state.analysisLevel]);

  if (actions.length === 0) return null;

  const priorityColors = {
    high: 'border-l-negative',
    medium: 'border-l-warning',
    low: 'border-l-muted-foreground',
  };

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-warning" />
        O que fazer agora? ({actions.length} ações)
      </h3>
      <div className="space-y-2">
        {actions.map((a, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border-l-4 ${priorityColors[a.priority]}`}>
            <span className={`flex-shrink-0 mt-0.5 ${a.priority === 'high' ? 'text-negative' : a.priority === 'medium' ? 'text-warning' : 'text-muted-foreground'}`}>
              {a.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">
                {a.action}: <span className="font-normal text-foreground/80">{a.target}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">{a.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
