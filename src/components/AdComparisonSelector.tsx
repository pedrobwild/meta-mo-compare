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

          {/* KPI Table */}
          <div className="border border-border/40 rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_minmax(90px,120px)_60px_minmax(90px,120px)] gap-0 bg-surface-2/60 border-b border-border/40 px-4 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Métrica</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-primary text-right truncate" title={rowA.name}>
                {rowA.name.length > 20 ? rowA.name.slice(0, 20) + '…' : rowA.name}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Δ</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-accent text-right truncate" title={rowB.name}>
                {rowB.name.length > 20 ? rowB.name.slice(0, 20) + '…' : rowB.name}
              </div>
            </div>
            {/* Table rows */}
            {KPI_DEFS.map((kpi, idx) => {
              const va = rowA.metrics[kpi.key];
              const vb = rowB.metrics[kpi.key];
              const equal = va === vb || (va === 0 && vb === 0);
              const aWins = !equal && (kpi.lowerIsBetter ? va < vb : va > vb);
              const bWins = !equal && !aWins;

              const diffPct = vb !== 0 ? ((va - vb) / Math.abs(vb)) * 100 : va !== 0 ? 100 : 0;
              const absDiff = Math.abs(diffPct);
              const diffIsGood = kpi.lowerIsBetter ? diffPct < 0 : diffPct > 0;

              return (
                <div
                  key={kpi.key as string}
                  className={`grid grid-cols-[1fr_minmax(90px,120px)_60px_minmax(90px,120px)] gap-0 px-4 py-2.5 items-center ${
                    idx % 2 === 0 ? 'bg-surface-1/20' : 'bg-transparent'
                  } ${idx < KPI_DEFS.length - 1 ? 'border-b border-border/20' : ''}`}
                >
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {kpi.label}
                  </div>
                  <div className="text-right flex items-center justify-end gap-1.5">
                    <span className={`text-sm font-bold font-mono ${
                      aWins ? 'text-primary' : bWins ? 'text-muted-foreground' : 'text-foreground'
                    }`}>
                      {kpi.format(va)}
                    </span>
                    {aWins && <Trophy className="h-3 w-3 text-warning flex-shrink-0" />}
                  </div>
                  <div className="text-center">
                    {!equal && absDiff > 0.1 ? (
                      <span className={`text-[10px] font-mono font-semibold ${
                        diffIsGood ? 'text-positive' : 'text-negative'
                      }`}>
                        {diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/30">—</span>
                    )}
                  </div>
                  <div className="text-right flex items-center justify-end gap-1.5">
                    <span className={`text-sm font-bold font-mono ${
                      bWins ? 'text-accent' : aWins ? 'text-muted-foreground' : 'text-foreground'
                    }`}>
                      {kpi.format(vb)}
                    </span>
                    {bWins && <Trophy className="h-3 w-3 text-warning flex-shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auto Summary */}
          <ComparisonSummary rowA={rowA} rowB={rowB} winsA={winsA} winsB={winsB} kpiDefs={KPI_DEFS} />
        </div>
      )}
    </div>
  );
}

/* ─── Textual Summary Sub-component ─── */
function ComparisonSummary({ rowA, rowB, winsA, winsB, kpiDefs }: {
  rowA: GroupedRow; rowB: GroupedRow; winsA: number; winsB: number; kpiDefs: KpiDef[];
}) {
  const summary = useMemo(() => {
    const ma = rowA.metrics;
    const mb = rowB.metrics;
    const nameA = rowA.name;
    const nameB = rowB.name;

    const strengthsA: string[] = [];
    const strengthsB: string[] = [];

    for (const kpi of kpiDefs) {
      const va = ma[kpi.key];
      const vb = mb[kpi.key];
      if (va === vb || (va === 0 && vb === 0)) continue;
      const aWins = kpi.lowerIsBetter ? va < vb : va > vb;
      const diffPct = vb !== 0 ? Math.abs(((va - vb) / Math.abs(vb)) * 100) : 100;
      if (diffPct < 5) continue; // ignore negligible differences

      const magnitude = diffPct >= 50 ? 'muito melhor' : diffPct >= 20 ? 'melhor' : 'levemente melhor';
      const entry = `${kpi.label} ${magnitude} (${diffPct.toFixed(0)}%)`;

      if (aWins) strengthsA.push(entry);
      else strengthsB.push(entry);
    }

    // Determine verdict
    let verdict = '';
    if (winsA > winsB) {
      verdict = `**${nameA}** é o vencedor geral com ${winsA} vitórias contra ${winsB}.`;
    } else if (winsB > winsA) {
      verdict = `**${nameB}** é o vencedor geral com ${winsB} vitórias contra ${winsA}.`;
    } else {
      verdict = `Empate técnico — ambos vencem em ${winsA} métricas cada.`;
    }

    // Funnel diagnosis
    let diagnosis = '';
    const aCtrBetter = ma.ctr_link > mb.ctr_link;
    const aCpaBetter = ma.cost_per_result > 0 && mb.cost_per_result > 0 && ma.cost_per_result < mb.cost_per_result;
    const aLpvBetter = ma.lpv_rate > mb.lpv_rate;

    if (aCtrBetter && !aCpaBetter) {
      diagnosis = `⚡ **${nameA}** tem CTR superior mas CPA pior — o gancho atrai cliques, mas a conversão pós-clique (LP ou oferta) precisa de ajuste.`;
    } else if (!aCtrBetter && aCpaBetter) {
      diagnosis = `⚡ **${nameB}** tem CTR superior mas CPA pior — considere testar o criativo de **${nameB}** com a landing page de **${nameA}**.`;
    }

    if (!diagnosis && ma.frequency > 0 && mb.frequency > 0) {
      const freqDiff = Math.abs(ma.frequency - mb.frequency);
      if (freqDiff > 0.5) {
        const highFreq = ma.frequency > mb.frequency ? nameA : nameB;
        const lowFreq = ma.frequency > mb.frequency ? nameB : nameA;
        diagnosis = `📊 **${highFreq}** tem frequência mais alta — priorize escalar **${lowFreq}** que tem mais vida útil.`;
      }
    }

    // Recommendation
    let recommendation = '';
    if (winsA !== winsB) {
      const winner = winsA > winsB ? nameA : nameB;
      const loser = winsA > winsB ? nameB : nameA;
      recommendation = `💡 **Ação sugerida:** Priorizar budget para **${winner}**. Avaliar variações criativas de **${loser}** ou pausar se a tendência se confirmar.`;
    } else {
      recommendation = `💡 **Ação sugerida:** Manter ambos ativos e monitorar tendência nos próximos 3-5 dias antes de decidir.`;
    }

    return { strengthsA, strengthsB, verdict, diagnosis, recommendation, nameA, nameB };
  }, [rowA, rowB, winsA, winsB, kpiDefs]);

  return (
    <div className="rounded-lg border border-border/30 bg-surface-2/20 p-4 space-y-3 text-xs leading-relaxed">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        📝 Resumo da comparação
      </h4>

      {/* Verdict */}
      <p className="text-foreground" dangerouslySetInnerHTML={{ __html: mdBold(summary.verdict) }} />

      {/* Strengths */}
      {summary.strengthsA.length > 0 && (
        <div>
          <span className="font-semibold text-primary">Pontos fortes de {summary.nameA}:</span>
          <ul className="mt-1 ml-4 list-disc text-muted-foreground space-y-0.5">
            {summary.strengthsA.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
      {summary.strengthsB.length > 0 && (
        <div>
          <span className="font-semibold text-accent">Pontos fortes de {summary.nameB}:</span>
          <ul className="mt-1 ml-4 list-disc text-muted-foreground space-y-0.5">
            {summary.strengthsB.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Diagnosis */}
      {summary.diagnosis && (
        <p className="text-foreground" dangerouslySetInnerHTML={{ __html: mdBold(summary.diagnosis) }} />
      )}

      {/* Recommendation */}
      <p className="text-foreground font-medium" dangerouslySetInnerHTML={{ __html: mdBold(summary.recommendation) }} />
    </div>
  );
}

/** Minimal bold markdown: **text** → <strong>text</strong> */
function mdBold(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
