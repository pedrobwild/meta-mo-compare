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
    <div className={`glass-card p-4 space-y-2 animate-fade-in ${statusBorder ? `border-l-2 ${statusBorder}` : ''}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{def.label}</p>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className={`h-3.5 w-3.5 cursor-help ${status === 'good' ? 'text-positive' : status === 'warning' ? 'text-warning' : status === 'bad' ? 'text-negative' : 'text-muted-foreground'}`} />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{def.format(value)}</p>

      {delta && !isNeutral && (
        <div className="flex items-center gap-1.5">
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-positive" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-negative" />
          )}
          <span className={`text-xs font-medium ${isPositive ? 'delta-positive' : 'delta-negative'}`}>
            {delta.percent !== null ? `${delta.percent > 0 ? '+' : ''}${delta.percent.toFixed(1)}%` : '—'}
          </span>
          <span className="text-xs text-muted-foreground">
            ({delta.absolute > 0 ? '+' : ''}{def.format(delta.absolute)})
          </span>
        </div>
      )}

      {isNeutral && delta && (
        <div className="flex items-center gap-1.5">
          <Minus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Sem variação</span>
        </div>
      )}

      {target !== undefined && target > 0 && (
        <div className="pt-1 border-t border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Meta</span>
            <span className={value >= target === !def.invertDelta ? 'delta-positive' : 'delta-negative'}>
              {def.format(target)}
            </span>
          </div>
          <div className="mt-1 h-1 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
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
