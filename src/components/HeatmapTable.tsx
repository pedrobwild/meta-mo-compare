import { useMemo, useState, Fragment } from 'react';
import { useAppState } from '@/lib/store';
import {
  aggregateMetrics,
  filterByPeriodWithFallback,
  groupByLevel,
  formatCurrency,
  formatNumber,
  formatPercent,
  type GroupedRow,
} from '@/lib/calculations';
import { computeVerdict, getHeatmapColor, type VerdictResult } from '@/lib/insights/verdicts';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, ChevronRight, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type SortKey = 'name' | 'verdict' | 'spend_brl' | 'results' | 'cost_per_result' | 'ctr_link' | 'cpc_link' | 'impressions' | 'landing_page_views' | 'cpm' | 'lpv_rate' | 'qualified_ctr' | 'result_per_lpv' | 'frequency';

interface ColDef {
  key: SortKey;
  label: string;
  shortLabel: string;
  format: (v: number) => string;
  invertDelta?: boolean;
  tooltip: string;
}

const columns: ColDef[] = [
  { key: 'spend_brl', label: 'Investimento', shortLabel: 'Invest.', format: formatCurrency, tooltip: 'Total gasto no período' },
  { key: 'impressions', label: 'Impressões', shortLabel: 'Impr.', format: v => formatNumber(v), tooltip: 'Número de vezes que o anúncio foi exibido' },
  { key: 'ctr_link', label: 'CTR Link', shortLabel: 'CTR', format: v => formatPercent(v), tooltip: 'Taxa de cliques no link. Acima de 1% é bom.' },
  { key: 'cpc_link', label: 'CPC Link', shortLabel: 'CPC', format: formatCurrency, invertDelta: true, tooltip: 'Custo por clique no link. Menor = melhor.' },
  { key: 'cpm', label: 'CPM', shortLabel: 'CPM', format: formatCurrency, invertDelta: true, tooltip: 'Custo por mil impressões. Indica competitividade do leilão.' },
  { key: 'landing_page_views', label: 'LPV', shortLabel: 'LPV', format: v => formatNumber(v), tooltip: 'Visualizações da landing page' },
  { key: 'lpv_rate', label: 'LPV Rate', shortLabel: 'LPV%', format: v => formatPercent(v * 100), tooltip: 'LPV / Cliques. Acima de 70% é bom. Abaixo de 50% = cliques "vazios".' },
  { key: 'results', label: 'Resultados', shortLabel: 'Result.', format: v => formatNumber(v), tooltip: 'Conversões registradas' },
  { key: 'cost_per_result', label: 'Custo/Resultado', shortLabel: 'CPA', format: formatCurrency, invertDelta: true, tooltip: 'Custo por resultado. Principal métrica de eficiência.' },
  { key: 'result_per_lpv', label: 'Result/LPV', shortLabel: 'R/LPV', format: v => formatPercent(v * 100), tooltip: 'Resultados / LPV. Taxa de conversão pós-landing page.' },
  { key: 'frequency', label: 'Frequência', shortLabel: 'Freq', format: v => formatNumber(v, 1), tooltip: 'Vezes média que cada pessoa viu o anúncio. Acima de 3 = saturação.' },
];

const INVERTED_KEYS = new Set(['cpc_link', 'cpm', 'cost_per_result', 'cost_per_lpv', 'frequency']);

export default function HeatmapTable() {
  const { state } = useAppState();
  const [sortKey, setSortKey] = useState<SortKey>('spend_brl');
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const currentRecords = useMemo(() => {
    if (!state.selectedPeriodKey) return [];
    return filterByPeriodWithFallback(state.records, state.selectedPeriodKey, state.truthSource);
  }, [state.records, state.selectedPeriodKey, state.truthSource]);

  const previousRecords = useMemo(() => {
    if (!state.comparisonPeriodKey) return [];
    return filterByPeriodWithFallback(state.records, state.comparisonPeriodKey, state.truthSource);
  }, [state.records, state.comparisonPeriodKey, state.truthSource]);

  const avgMetrics = useMemo(() => aggregateMetrics(currentRecords), [currentRecords]);

  const rows = useMemo(() => {
    if (!state.selectedPeriodKey) return [];
    return groupByLevel(currentRecords, previousRecords, state.analysisLevel, state.searchQuery, state.includeInactive);
  }, [currentRecords, previousRecords, state.analysisLevel, state.searchQuery, state.includeInactive, state.selectedPeriodKey]);

  const rowsWithVerdicts = useMemo(() => {
    return rows.map(row => ({
      row,
      verdict: computeVerdict(row, avgMetrics),
    }));
  }, [rows, avgMetrics]);

  const sorted = useMemo(() => {
    return [...rowsWithVerdicts].sort((a, b) => {
      if (sortKey === 'name') return sortAsc ? a.row.name.localeCompare(b.row.name) : b.row.name.localeCompare(a.row.name);
      if (sortKey === 'verdict') return sortAsc ? a.verdict.score - b.verdict.score : b.verdict.score - a.verdict.score;
      const aVal = (a.row.metrics as any)[sortKey] ?? 0;
      const bVal = (b.row.metrics as any)[sortKey] ?? 0;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
  }, [rowsWithVerdicts, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const getChildren = (parentKey: string, parentLevel: 'campaign' | 'adset'): { row: GroupedRow; verdict: VerdictResult }[] => {
    const childLevel = parentLevel === 'campaign' ? 'adset' : 'ad';
    const filterByParent = (recs: typeof currentRecords) => {
      if (parentLevel === 'campaign') return recs.filter(r => (r.campaign_key || 'sem-campanha') === parentKey);
      return recs.filter(r => (r.adset_key || 'sem-conjunto') === parentKey);
    };
    const childRows = groupByLevel(filterByParent(currentRecords), filterByParent(previousRecords), childLevel as any, '', state.includeInactive)
      .sort((a, b) => b.metrics.spend_brl - a.metrics.spend_brl);
    return childRows.map(row => ({ row, verdict: computeVerdict(row, avgMetrics) }));
  };

  const canDrillDown = state.analysisLevel !== 'ad';

  if (sorted.length === 0) return null;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const renderRow = ({ row, verdict }: { row: GroupedRow; verdict: VerdictResult }, depth: number) => {
    const isExpanded = expanded.has(`${depth}-${row.key}`);
    const showExpander = canDrillDown && depth < 2;
    const indent = depth * 20;

    return (
      <Fragment key={`${depth}-${row.key}`}>
        <tr
          className={`border-b border-border/30 hover:bg-secondary/40 transition-colors ${showExpander ? 'cursor-pointer' : ''} ${depth > 0 ? 'bg-secondary/10' : ''}`}
          onClick={showExpander ? () => toggleExpand(`${depth}-${row.key}`) : undefined}
        >
          {/* Name + Verdict */}
          <td className="p-2.5 max-w-[200px] sticky left-0 bg-card z-10">
            <div className="flex items-center gap-1" style={{ paddingLeft: `${indent}px` }}>
              {showExpander && (
                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              )}
              <p className={`truncate text-xs ${depth === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {row.name}
              </p>
            </div>
          </td>

          {/* Verdict */}
          <td className="p-2.5 text-center">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${verdict.color}`}>
              {verdict.emoji} {verdict.score}
            </span>
          </td>

          {/* Metric cells with heatmap */}
          {columns.map(col => {
            const val = (row.metrics as any)[col.key] ?? 0;
            const heatColor = getHeatmapColor(val, (avgMetrics as any)[col.key], INVERTED_KEYS.has(col.key));
            const d = row.delta.deltas[col.key];
            const hasChange = d && d.percent !== null && Math.abs(d.percent) >= 0.5;
            const positive = d ? (col.invertDelta ? d.absolute < 0 : d.absolute > 0) : null;

            return (
              <td key={col.key} className={`p-2.5 text-right whitespace-nowrap ${heatColor}`}>
                <p className={`text-xs ${depth === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {col.format(val)}
                </p>
                {hasChange && (
                  <span className={`text-[10px] ${positive ? 'text-positive' : 'text-negative'}`}>
                    {d.percent! > 0 ? '+' : ''}{d.percent!.toFixed(1)}%
                  </span>
                )}
              </td>
            );
          })}
        </tr>
        {isExpanded && (() => {
          const childLevel = depth === 0 ? (state.analysisLevel === 'campaign' ? 'campaign' : 'adset') : 'adset';
          const children = getChildren(row.key, childLevel as any);
          return children.map(child => renderRow(child, depth + 1));
        })()}
      </Fragment>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-2.5 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground sticky left-0 bg-secondary/30 z-10 min-w-[180px]"
                  onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-1">Nome <SortIcon col="name" /></span>
                </th>
                <th className="text-center p-2.5 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground min-w-[60px]"
                  onClick={() => toggleSort('verdict')}>
                  <span className="flex items-center justify-center gap-1">Score <SortIcon col="verdict" /></span>
                </th>
                {columns.map(col => (
                  <th key={col.key}
                    className="text-right p-2.5 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground whitespace-nowrap"
                    onClick={() => toggleSort(col.key)}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center justify-end gap-1">
                          {col.shortLabel} <SortIcon col={col.key} />
                          <Info className="h-3 w-3 opacity-40" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px]">
                        <p className="text-xs">{col.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 50).map(item => renderRow(item, 0))}
            </tbody>
          </table>
        </div>
        {sorted.length > 50 && (
          <p className="text-xs text-muted-foreground p-3 text-center">Exibindo 50 de {sorted.length} itens</p>
        )}
      </div>
    </TooltipProvider>
  );
}
