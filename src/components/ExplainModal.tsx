import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { ExplainResult } from '@/lib/metrics/explain';
import { formatMetric } from '@/lib/metrics';

interface Props {
  open: boolean;
  onClose: () => void;
  explain: ExplainResult | null;
}

export default function ExplainModal({ open, onClose, explain }: Props) {
  if (!explain) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-card border-border/50 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Explicar variação: {explain.targetLabel}
            <Badge variant="outline" className={explain.changePercent > 0 ? 'text-emerald-400' : 'text-red-400'}>
              {explain.changePercent > 0 ? '+' : ''}{explain.changePercent.toFixed(1)}%
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{explain.narrative}</p>

        <div className="space-y-2 mt-4">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drivers</h4>
          {explain.drivers.map(d => (
            <div key={d.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/10 border border-border/20">
              <div className="flex items-center gap-2">
                {d.impact === 'positive' ? <ArrowUp className="h-3.5 w-3.5 text-emerald-400" /> :
                 d.impact === 'negative' ? <ArrowDown className="h-3.5 w-3.5 text-red-400" /> :
                 <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="text-sm font-medium">{d.label}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground font-mono">
                  {formatMetric(d.key, d.previous)} → {formatMetric(d.key, d.current)}
                </span>
                <Badge variant="outline" className={`text-[10px] ${d.percentChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {d.percentChange > 0 ? '+' : ''}{d.percentChange.toFixed(1)}%
                </Badge>
                <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${d.impact === 'positive' ? 'bg-emerald-400' : d.impact === 'negative' ? 'bg-red-400' : 'bg-muted-foreground'}`}
                    style={{ width: `${Math.min(d.contribution * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
