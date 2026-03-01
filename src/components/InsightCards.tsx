import { useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  computeDeltas,
  groupByLevel,
} from '@/lib/calculations';
import { generateInsights } from '@/lib/insights/rules';
import type { InsightCard } from '@/lib/insights/types';
import { AlertTriangle, Lightbulb, ArrowRight, Shield, Zap, Eye, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  creative: <Lightbulb className="h-4 w-4" />,
  auction: <DollarSign className="h-4 w-4" />,
  post_click: <Eye className="h-4 w-4" />,
  efficiency: <Zap className="h-4 w-4" />,
  fatigue: <AlertTriangle className="h-4 w-4" />,
  budget: <Shield className="h-4 w-4" />,
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'text-negative',
  medium: 'text-warning',
  low: 'text-muted-foreground',
};

interface InsightCardsProps {
  onFilterTable?: (key: string, value: string) => void;
}

export default function InsightCards({ onFilterTable }: InsightCardsProps) {
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();

  const insights = useMemo(() => {
    if (current.length === 0) return [];

    const currentMetrics = aggregateMetrics(current);
    const previousMetrics = previous.length > 0 ? aggregateMetrics(previous) : null;
    const delta = computeDeltas(currentMetrics, previousMetrics);
    const rows = groupByLevel(current, previous, state.analysisLevel, '', false);

    return generateInsights(currentMetrics, delta, rows);
  }, [current, previous, state.analysisLevel]);

  if (insights.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        Insights ({insights.length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map(insight => (
          <div
            key={insight.id}
            className="border border-border rounded-lg p-3 space-y-2 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={SEVERITY_COLORS[insight.severity]}>
                  {CATEGORY_ICONS[insight.category] || <Zap className="h-4 w-4" />}
                </span>
                <h4 className="text-sm font-medium text-foreground">{insight.title}</h4>
              </div>
              <Badge variant={insight.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px] flex-shrink-0">
                {insight.confidence > 0.8 ? 'Alta' : insight.confidence > 0.5 ? 'Média' : 'Baixa'}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">{insight.description}</p>

            <div className="bg-secondary/50 rounded px-2 py-1">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Evidência:</span> {insight.evidence}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-primary">{insight.action}</p>
              {insight.affectedItems && insight.affectedItems.length > 0 && onFilterTable && (
                <button
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => onFilterTable('search', insight.affectedItems![0])}
                >
                  Ver na tabela <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
