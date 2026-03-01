import { useState, useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { groupByLevel, type GroupedRow } from '@/lib/calculations';
import type { AggregatedMetrics } from '@/lib/types';
import { Trophy, X, Check, ChevronsUpDown, GitCompareArrows, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KpiDef {
  key: keyof AggregatedMetrics;
  label: string;
  format: (v: number) => string;
  lowerIsBetter?: boolean;
}

const KPI_DEFS: KpiDef[] = [
  { key: 'spend_brl', label: 'INVESTIMENTO', format: v => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: 'impressions', label: 'IMPRESSÕES', format: v => v.toLocaleString('pt-BR') },
  { key: 'link_clicks', label: 'CLIQUES NO LINK', format: v => v.toLocaleString('pt-BR') },
  { key: 'ctr_link', label: 'CTR LINK', format: v => `${v.toFixed(2)}%` },
  { key: 'cpc_link', label: 'CPC LINK', format: v => `R$ ${v.toFixed(2)}`, lowerIsBetter: true },
  { key: 'cpm', label: 'CPM', format: v => `R$ ${v.toFixed(2)}`, lowerIsBetter: true },
  { key: 'results', label: 'RESULTADOS', format: v => v.toLocaleString('pt-BR') },
  { key: 'cost_per_result', label: 'CUSTO/RESULTADO', format: v => `R$ ${v.toFixed(2)}`, lowerIsBetter: true },
  { key: 'landing_page_views', label: 'LPV', format: v => v.toLocaleString('pt-BR') },
  { key: 'cost_per_lpv', label: 'CUSTO/LPV', format: v => `R$ ${v.toFixed(2)}`, lowerIsBetter: true },
  { key: 'reach', label: 'ALCANCE', format: v => v.toLocaleString('pt-BR') },
  { key: 'frequency', label: 'FREQUÊNCIA', format: v => v.toFixed(2), lowerIsBetter: true },
  { key: 'lpv_rate', label: 'LPV RATE', format: v => `${(v * 100).toFixed(1)}%` },
  { key: 'qualified_ctr', label: 'QUALIFIED CTR', format: v => `${v.toFixed(2)}%` },
  { key: 'result_per_lpv', label: 'RESULT/LPV', format: v => `${(v * 100).toFixed(1)}%` },
];

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

  // Detect dominant result_type per row
  const rowResultType = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of rows) {
      const types: Record<string, number> = {};
      for (const rec of row.records) {
        const t = rec.result_type || 'Sem tipo';
        types[t] = (types[t] || 0) + rec.spend_brl;
      }
      // Pick the result_type with the most spend
      let best = 'Sem tipo';
      let bestVal = 0;
      for (const [t, v] of Object.entries(types)) {
        if (v > bestVal) { best = t; bestVal = v; }
      }
      map[row.key] = best;
    }
    return map;
  }, [rows]);

  // Group rows by result_type for the selector
  const rowsByType = useMemo(() => {
    const groups: Record<string, typeof rows> = {};
    for (const row of rows) {
      const t = rowResultType[row.key] || 'Sem tipo';
      if (!groups[t]) groups[t] = [];
      groups[t].push(row);
    }
    return groups;
  }, [rows, rowResultType]);

  // Determine the active result_type based on the first selected item
  const activeResultType = selectedKeys.length > 0
    ? rowResultType[selectedKeys[0]] || null
    : null;

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      // If selecting a new item with different result_type, reset selection
      const newType = rowResultType[key];
      if (prev.length > 0 && rowResultType[prev[0]] !== newType) {
        return [key]; // reset to new type
      }
      if (prev.length >= 2) return [prev[1], key]; // rotate: keep last, add new
      return [...prev, key];
    });
  };

  const levelLabel = state.analysisLevel === 'ad' ? 'anúncios' : state.analysisLevel === 'adset' ? 'conjuntos' : 'campanhas';

  const selectedRows = rows.filter(r => selectedKeys.includes(r.key));
  const rowA = selectedRows[0] ?? null;
  const rowB = selectedRows[1] ?? null;

  if (rows.length < 2) return null;

  // Count wins
  let winsA = 0;
  let winsB = 0;
  if (rowA && rowB) {
    for (const kpi of KPI_DEFS) {
      const va = rowA.metrics[kpi.key];
      const vb = rowB.metrics[kpi.key];
      if (va === vb) continue;
      if (va === 0 && vb === 0) continue;
      const aWins = kpi.lowerIsBetter ? va < vb : va > vb;
      if (aWins) winsA++;
      else winsB++;
    }
  }

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
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
                Selecionar ({selectedKeys.length}/2)
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <ScrollArea className="max-h-72">
                <div className="p-1">
                  {Object.entries(rowsByType).map(([type, typeRows]) => {
                    const isDisabledGroup = activeResultType !== null && type !== activeResultType;
                    return (
                      <div key={type}>
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/30 flex items-center justify-between">
                          <span>{type}</span>
                          <span className="font-mono">{typeRows.length}</span>
                        </div>
                        {typeRows.map(row => {
                          const isSelected = selectedKeys.includes(row.key);
                          const isDisabled = isDisabledGroup && !isSelected;
                          return (
                            <button
                              key={row.key}
                              onClick={() => !isDisabled && toggleKey(row.key)}
                              disabled={isDisabled}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs rounded-md transition-colors ${
                                isSelected ? 'bg-primary/10 text-primary' : 
                                isDisabled ? 'opacity-40 cursor-not-allowed text-muted-foreground' :
                                'hover:bg-muted/50 text-foreground'
                              }`}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                isSelected ? 'bg-primary border-primary' : 'border-border'
                              }`}>
                                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                              </div>
                              <span className="truncate flex-1">{row.name}</span>
                              <span className="text-muted-foreground font-mono text-[10px]">R${row.metrics.spend_brl.toFixed(0)}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {activeResultType && (
                <div className="px-3 py-2 border-t border-border/30 text-[10px] text-muted-foreground">
                  Comparando apenas: <span className="font-semibold text-foreground">{activeResultType}</span>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Selected pills */}
      {selectedKeys.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedKeys.map((key, i) => {
            const row = rows.find(r => r.key === key);
            if (!row) return null;
            return (
              <Badge key={key} variant="secondary" className="text-[10px] gap-1 pr-1">
                <span className={`font-bold ${i === 0 ? 'text-primary' : 'text-accent'}`}>
                  {i === 0 ? 'A' : 'B'}
                </span>
                {row.name.slice(0, 30)}{row.name.length > 30 ? '…' : ''}
                <button onClick={() => toggleKey(key)} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {selectedKeys.length === 1 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Selecione mais 1 {state.analysisLevel === 'campaign' ? 'campanha' : state.analysisLevel === 'adset' ? 'conjunto' : 'anúncio'} para comparar
        </p>
      )}

      {/* Side-by-side KPI comparison */}
      {rowA && rowB && (
        <div className="space-y-4">
          {/* Score header */}
          <div className="flex items-center justify-between rounded-lg bg-surface-2/40 p-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {winsA >= winsB && <Crown className="h-4 w-4 text-warning flex-shrink-0" />}
              <div className="min-w-0">
                <span className="text-xs font-bold text-primary truncate block">{rowA.name}</span>
                <span className="text-[10px] text-muted-foreground">{winsA} vitórias</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 flex-shrink-0">
              <span className="text-lg font-bold font-mono text-primary">{winsA}</span>
              <span className="text-xs text-muted-foreground">×</span>
              <span className="text-lg font-bold font-mono text-accent">{winsB}</span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <div className="min-w-0 text-right">
                <span className="text-xs font-bold text-accent truncate block">{rowB.name}</span>
                <span className="text-[10px] text-muted-foreground">{winsB} vitórias</span>
              </div>
              {winsB >= winsA && <Crown className="h-4 w-4 text-warning flex-shrink-0" />}
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {KPI_DEFS.map(kpi => {
              const va = rowA.metrics[kpi.key];
              const vb = rowB.metrics[kpi.key];
              const equal = va === vb || (va === 0 && vb === 0);
              const aWins = !equal && (kpi.lowerIsBetter ? va < vb : va > vb);
              const bWins = !equal && !aWins;

              // Calculate % difference (A relative to B)
              const diffPct = vb !== 0 ? ((va - vb) / Math.abs(vb)) * 100 : va !== 0 ? 100 : 0;
              const absDiff = Math.abs(diffPct);
              // For "lower is better" metrics, negative diff means A is better
              const diffIsGood = kpi.lowerIsBetter ? diffPct < 0 : diffPct > 0;

              return (
                <div key={kpi.key as string} className="border border-border/40 rounded-lg p-3 bg-surface-1/30">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    {kpi.label}
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    {/* Value A */}
                    <div className="flex-1">
                      <div className={`text-sm font-bold font-mono ${
                        aWins ? 'text-primary' : bWins ? 'text-muted-foreground' : 'text-foreground'
                      }`}>
                        {kpi.format(va)}
                      </div>
                      {aWins && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <Trophy className="h-3 w-3 text-warning" />
                          <span className="text-[9px] font-semibold text-warning">CAMPEÃ</span>
                        </div>
                      )}
                    </div>

                    {/* Divider + diff */}
                    <div className="flex flex-col items-center pb-1 flex-shrink-0">
                      <div className="text-[10px] text-muted-foreground/40 font-mono">vs</div>
                      {!equal && absDiff > 0.1 && (
                        <div className={`text-[9px] font-mono font-semibold mt-0.5 ${
                          diffIsGood ? 'text-positive' : 'text-negative'
                        }`}>
                          {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                        </div>
                      )}
                    </div>

                    {/* Value B */}
                    <div className="flex-1 text-right">
                      <div className={`text-sm font-bold font-mono ${
                        bWins ? 'text-accent' : aWins ? 'text-muted-foreground' : 'text-foreground'
                      }`}>
                        {kpi.format(vb)}
                      </div>
                      {bWins && (
                        <div className="flex items-center gap-0.5 mt-0.5 justify-end">
                          <Trophy className="h-3 w-3 text-warning" />
                          <span className="text-[9px] font-semibold text-warning">CAMPEÃ</span>
                        </div>
                      )}
                    </div>
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
