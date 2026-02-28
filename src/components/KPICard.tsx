import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MetricDef } from '@/lib/calculations';

interface KPICardProps {
  def: MetricDef;
  value: number;
  delta?: { absolute: number; percent: number | null } | null;
  target?: number;
}

export default function KPICard({ def, value, delta, target }: KPICardProps) {
  const isPositive = delta ? (def.invertDelta ? delta.absolute < 0 : delta.absolute > 0) : null;
  const isNeutral = !delta || delta.absolute === 0;

  return (
    <div className="glass-card p-4 space-y-2 animate-fade-in">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{def.label}</p>
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
