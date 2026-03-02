import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import type { MetricDef } from '@/lib/calculations';
import { VERTICALS, DEFAULT_VERTICAL, getBenchmarkStatus, getTooltipText } from '@/lib/benchmarks';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface KPICardProps {
  def: MetricDef;
  value: number;
  delta?: { absolute: number; percent: number | null } | null;
  target?: number;
}

export default function KPICard({ def, value, delta, target }: KPICardProps) {
  const isPositive = delta ? (def.invertDelta ? delta.absolute < 0 : delta.absolute > 0) : null;
  const isNeutral = !delta || delta.absolute === 0;
  const benchmarks = VERTICALS[DEFAULT_VERTICAL];
  const status = getBenchmarkStatus(def.key, value, benchmarks);
  const tooltip = getTooltipText(def.key, value, benchmarks);

  const statusBorder = status === 'good' ? 'border-l-positive' : status === 'warning' ? 'border-l-warning' : status === 'bad' ? 'border-l-negative' : '';

  return (
    <div className={`bg-card border border-border rounded-meta-card p-4 space-y-2 animate-fade-in shadow-meta-subtle ${statusBorder ? `border-l-[3px] ${statusBorder}` : ''}`}>
      <div className="flex items-center justify-between">
        <p className="meta-section-label">{def.label}</p>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className={`h-3.5 w-3.5 cursor-help ${status === 'good' ? 'text-positive' : status === 'warning' ? 'text-warning' : status === 'bad' ? 'text-negative' : 'text-muted-foreground'}`} strokeWidth={1.5} />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs rounded-meta-card shadow-meta-card">
                <p className="text-meta-caption">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <p className="text-meta-kpi text-foreground">{def.format(value)}</p>

      {delta && !isNeutral && (
        <div className="flex items-center gap-1.5">
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-meta-pill text-meta-caption font-semibold ${
            isPositive
              ? 'bg-positive/10 text-positive'
              : 'bg-negative/10 text-negative'
          }`}>
            {isPositive ? (
              <TrendingUp className="h-3 w-3" strokeWidth={1.5} />
            ) : (
              <TrendingDown className="h-3 w-3" strokeWidth={1.5} />
            )}
            {delta.percent !== null ? `${delta.percent > 0 ? '+' : ''}${delta.percent.toFixed(1)}%` : '—'}
          </div>
        </div>
      )}

      {isNeutral && delta && (
        <div className="flex items-center gap-1.5">
          <Minus className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-meta-caption text-muted-foreground">Sem variação</span>
        </div>
      )}

      {target !== undefined && target > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="flex justify-between text-meta-caption">
            <span className="text-muted-foreground">Meta</span>
            <span className={value >= target === !def.invertDelta ? 'text-positive font-semibold' : 'text-negative font-semibold'}>
              {def.format(target)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (value / target >= 1) === !def.invertDelta ? 'bg-positive' : 'bg-negative'
              }`}
              style={{ width: `${Math.min(100, (def.invertDelta ? target / (value || 1) : value / target) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
