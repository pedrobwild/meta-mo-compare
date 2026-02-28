import { useMemo, useState } from 'react';
import { useAppState } from '@/lib/store';
import {
  filterByTruthSourceWithFallback,
  groupByLevel,
  formatCurrency,
  formatNumber,
  formatPercent,
  type GroupedRow,
} from '@/lib/calculations';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';

type SortKey = 'name' | 'spend_brl' | 'results' | 'cost_per_result' | 'ctr_link' | 'cpc_link' | 'link_clicks' | 'impressions' | 'landing_page_views' | 'cpm';

export default function RankingTable() {
  const { state } = useAppState();
  const [sortKey, setSortKey] = useState<SortKey>('spend_brl');
  const [sortAsc, setSortAsc] = useState(false);

  const rows = useMemo(() => {
    if (!state.selectedMonth) return [];
    const current = filterByTruthSourceWithFallback(state.records, state.selectedMonth, state.truthSource);
    const previous = state.comparisonMonth
      ? filterByTruthSourceWithFallback(state.records, state.comparisonMonth, state.truthSource)
      : [];
    return groupByLevel(current, previous, state.analysisLevel, state.searchQuery, state.includeInactive);
  }, [state]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (sortKey === 'name') {
        return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const aVal = (a.metrics as any)[sortKey] ?? 0;
      const bVal = (b.metrics as any)[sortKey] ?? 0;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
  }, [rows, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  if (sorted.length === 0) return null;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const DeltaCell = ({ row, metricKey, invertDelta }: { row: GroupedRow; metricKey: string; invertDelta?: boolean }) => {
    const d = row.delta.deltas[metricKey];
    if (!d || d.percent === null) return <span className="text-muted-foreground text-xs">—</span>;
    const positive = invertDelta ? d.absolute < 0 : d.absolute > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? 'delta-positive' : 'delta-negative'}`}>
        {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {d.percent > 0 ? '+' : ''}{d.percent.toFixed(1)}%
      </span>
    );
  };

  const columns: { key: SortKey; label: string; format: (v: number) => string; invertDelta?: boolean }[] = [
    { key: 'spend_brl', label: 'Invest.', format: formatCurrency },
    { key: 'impressions', label: 'Impr.', format: v => formatNumber(v) },
    { key: 'link_clicks', label: 'Cliques', format: v => formatNumber(v) },
    { key: 'ctr_link', label: 'CTR', format: v => formatPercent(v) },
    { key: 'cpc_link', label: 'CPC', format: formatCurrency, invertDelta: true },
    { key: 'cpm', label: 'CPM', format: formatCurrency, invertDelta: true },
    { key: 'results', label: 'Result.', format: v => formatNumber(v) },
    { key: 'cost_per_result', label: 'CPA', format: formatCurrency, invertDelta: true },
    { key: 'landing_page_views', label: 'LPV', format: v => formatNumber(v) },
  ];

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                className="text-left p-3 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground"
                onClick={() => toggleSort('name')}
              >
                <span className="flex items-center gap-1">Nome <SortIcon col="name" /></span>
              </th>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="text-right p-3 text-xs text-muted-foreground font-medium cursor-pointer hover:text-foreground whitespace-nowrap"
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="flex items-center justify-end gap-1">{col.label} <SortIcon col={col.key} /></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 50).map((row, i) => (
              <tr key={row.key} className="border-b border-border/50 hover:bg-secondary/50 transition-colors" style={{ animationDelay: `${i * 20}ms` }}>
                <td className="p-3 max-w-[250px]">
                  <p className="text-foreground font-medium truncate">{row.name}</p>
                </td>
                {columns.map(col => (
                  <td key={col.key} className="p-3 text-right whitespace-nowrap">
                    <div className="space-y-0.5">
                      <p className="text-foreground">{col.format((row.metrics as any)[col.key])}</p>
                      <DeltaCell row={row} metricKey={col.key} invertDelta={col.invertDelta} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > 50 && (
        <p className="text-xs text-muted-foreground p-3 text-center">Exibindo 50 de {sorted.length} itens</p>
      )}
    </div>
  );
}
