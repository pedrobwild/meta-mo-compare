import { useState, useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { groupByLevel, type GroupedRow } from '@/lib/calculations';
import { generateComparisons, type AdComparison } from '@/lib/insights/comparisons';
import { ArrowRight, Trophy, Minus, X, Check, ChevronsUpDown, GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AdComparisonSelector() {
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    if (current.length === 0) return [];
    return groupByLevel(current, previous, state.analysisLevel, '', false)
      .filter(r => r.metrics.spend_brl > 0 && r.metrics.impressions > 100);
  }, [current, previous, state.analysisLevel]);

  const comparisons = useMemo(() => {
    if (selectedKeys.length < 2) return [];
    const selected = rows.filter(r => selectedKeys.includes(r.key));
    return generateComparisons(selected);
  }, [selectedKeys, rows]);

  const toggleKey = (key: string) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const levelLabel = state.analysisLevel === 'ad' ? 'anúncios' : state.analysisLevel === 'adset' ? 'conjuntos' : 'campanhas';

  if (rows.length < 2) return null;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          Comparar {levelLabel}
        </h3>
        <div className="flex items-center gap-2">
          {selectedKeys.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedKeys([])}>
              Limpar
            </Button>
          )}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-primary/30">
                <ChevronsUpDown className="h-3 w-3" />
                Selecionar ({selectedKeys.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <ScrollArea className="max-h-64">
                <div className="p-1">
                  {rows.map(row => {
                    const isSelected = selectedKeys.includes(row.key);
                    return (
                      <button
                        key={row.key}
                        onClick={() => toggleKey(row.key)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs rounded-md transition-colors ${
                          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50 text-foreground'
                        }`}
                      >
                        <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="truncate flex-1">{row.name}</span>
                        <span className="text-muted-foreground font-mono">R${row.metrics.spend_brl.toFixed(0)}</span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Selected pills */}
      {selectedKeys.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedKeys.map(key => {
            const row = rows.find(r => r.key === key);
            if (!row) return null;
            return (
              <Badge key={key} variant="secondary" className="text-[10px] gap-1 pr-1">
                {row.name.slice(0, 25)}{row.name.length > 25 ? '…' : ''}
                <button onClick={() => toggleKey(key)} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {selectedKeys.length === 1 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Selecione pelo menos mais 1 item para comparar
        </p>
      )}

      {/* Comparison results */}
      {comparisons.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {comparisons.map(comp => (
            <ComparisonResultCard key={comp.id} comparison={comp} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComparisonResultCard({ comparison: c }: { comparison: AdComparison }) {
  return (
    <div className="border border-border/50 rounded-lg p-4 space-y-3 bg-surface-2/20">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground">{c.title}</h4>
        <span className="text-[10px] text-muted-foreground">{c.description}</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className={`font-medium ${c.winner === 'A' ? 'text-positive' : 'text-foreground'} truncate max-w-[40%]`}>
          {c.winner === 'A' && '👑 '}{c.adA.name}
        </span>
        <span className="text-muted-foreground">vs</span>
        <span className={`font-medium ${c.winner === 'B' ? 'text-positive' : 'text-foreground'} truncate max-w-[40%]`}>
          {c.winner === 'B' && '👑 '}{c.adB.name}
        </span>
      </div>

      <div className="space-y-1.5">
        {c.metrics.map(m => (
          <div key={m.label} className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-16 flex-shrink-0">{m.label}</span>
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

      <div className="bg-primary/10 rounded-md px-3 py-2">
        <p className="text-[11px] text-primary flex items-start gap-1.5">
          <ArrowRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
          {c.recommendation}
        </p>
      </div>
    </div>
  );
}
