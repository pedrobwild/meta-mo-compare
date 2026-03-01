import { useMemo, useState, Fragment } from 'react';
import { useAppState } from '@/lib/store';
import {
  filterByPeriodWithFallback,
  groupByLevel,
  formatCurrency,
  formatNumber,
  formatPercent,
  type GroupedRow,
} from '@/lib/calculations';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type SortKey = 'name' | 'spend_brl' | 'results' | 'cost_per_result' | 'ctr_link' | 'cpc_link' | 'link_clicks' | 'impressions' | 'landing_page_views' | 'cpm' | 'lpv_rate' | 'qualified_ctr';

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
  { key: 'lpv_rate', label: 'LPV Rate', format: v => formatPercent(v * 100) },
  { key: 'qualified_ctr', label: 'Q.CTR', format: v => formatPercent(v) },
];

// Detect badges based on metrics
function getBadges(row: GroupedRow): { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }[] {
  const badges: { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }[] = [];
  const m = row.metrics;
  const d = row.delta;

  // Fadiga: freq high + CTR dropping
  if (m.frequency > 3 && d.deltas['ctr_link']?.percent && d.deltas['ctr_link'].percent < -10) {
    badges.push({ label: 'Fadiga', variant: 'destructive' });
  }

  // Clique ruim: CPC baixo + Cost/LPV alto
  if (m.cpc_link > 0 && m.cost_per_lpv > m.cpc_link * 3) {
    badges.push({ label: 'Clique ruim', variant: 'destructive' });
  }

  // Leilão: CPM subindo + CTR estável
  if (d.deltas['cpm']?.percent && d.deltas['cpm'].percent > 15
    && d.deltas['ctr_link']?.percent && Math.abs(d.deltas['ctr_link'].percent) < 5) {
    badges.push({ label: 'Leilão', variant: 'secondary' });
  }

  // Pós-clique: lpv_rate baixo
  if (m.lpv_rate > 0 && m.lpv_rate < 0.5) {
    badges.push({ label: 'Pós-clique', variant: 'outline' });
  }

  return badges;
}

export default function RankingTable() {
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

  const rows = useMemo(() => {
    if (!state.selectedPeriodKey) return [];
    return groupByLevel(currentRecords, previousRecords, state.analysisLevel, state.searchQuery, state.includeInactive);
  }, [currentRecords, previousRecords, state.analysisLevel, state.searchQuery, state.includeInactive, state.selectedPeriodKey]);

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

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getChildren = (parentKey: string, parentLevel: 'campaign' | 'adset'): GroupedRow[] => {
    const childLevel = parentLevel === 'campaign' ? 'adset' : 'ad';
    const filterByParent = (recs: typeof currentRecords) => {
      if (parentLevel === 'campaign') {
        return recs.filter(r => (r.campaign_key || 'sem-campanha') === parentKey);
      }
      return recs.filter(r => (r.adset_key || 'sem-conjunto') === parentKey);
    };
    const childCurrent = filterByParent(currentRecords);
    const childPrevious = filterByParent(previousRecords);
    return groupByLevel(childCurrent, childPrevious, childLevel as any, '', state.includeInactive)
      .sort((a, b) => b.metrics.spend_brl - a.metrics.spend_brl);
  };

  const canDrillDown = state.analysisLevel === 'campaign' || state.analysisLevel === 'adset';

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

  const renderRow = (row: GroupedRow, depth: number) => {
    const isExpanded = expanded.has(row.key);
    const showExpander = canDrillDown && depth === 0 && state.analysisLevel !== 'ad';
    const childLevel = state.analysisLevel === 'campaign' ? 'campaign' : 'adset';
    const indent = depth * 24;
    const badges = depth === 0 ? getBadges(row) : [];

    return (
      <Fragment key={`${depth}-${row.key}`}>
        <tr
          className={`border-b border-border/50 hover:bg-secondary/50 transition-colors ${showExpander ? 'cursor-pointer' : ''} ${depth > 0 ? 'bg-secondary/20' : ''}`}
          onClick={showExpander ? () => toggleExpand(row.key) : undefined}
        >
          <td className="p-3 max-w-[280px]">
            <div className="flex items-center gap-1" style={{ paddingLeft: `${indent}px` }}>
              {showExpander && (
                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              )}
              {depth > 0 && !showExpander && <span className="w-3.5 flex-shrink-0" />}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`truncate ${depth === 0 ? 'text-foreground font-medium' : 'text-muted-foreground text-xs'}`}>
                    {row.name}
                  </p>
                  {depth === 0 && (
                    <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium flex-shrink-0 ${
                      row.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {row.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  )}
                </div>
                {badges.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {badges.map(b => (
                      <Badge key={b.label} variant={b.variant} className="text-[10px] px-1.5 py-0">{b.label}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
          {columns.map(col => (
            <td key={col.key} className="p-3 text-right whitespace-nowrap">
              <div className="space-y-0.5">
                <p className={depth === 0 ? 'text-foreground' : 'text-muted-foreground text-xs'}>
                  {col.format((row.metrics as any)[col.key])}
                </p>
                <DeltaCell row={row} metricKey={col.key} invertDelta={col.invertDelta} />
              </div>
            </td>
          ))}
        </tr>
        {isExpanded && getChildren(row.key, childLevel as any).map(child => {
          if (state.analysisLevel === 'campaign') {
            return renderAdsetRow(child, 1);
          }
          return renderRow(child, 1);
        })}
      </Fragment>
    );
  };

  const renderAdsetRow = (row: GroupedRow, depth: number) => {
    const isExpanded = expanded.has(`adset-${row.key}`);
    const indent = depth * 24;

    return (
      <Fragment key={`adset-${row.key}`}>
        <tr
          className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer bg-secondary/20"
          onClick={() => {
            setExpanded(prev => {
              const next = new Set(prev);
              const k = `adset-${row.key}`;
              if (next.has(k)) next.delete(k); else next.add(k);
              return next;
            });
          }}
        >
          <td className="p-3 max-w-[280px]">
            <div className="flex items-center gap-1" style={{ paddingLeft: `${indent}px` }}>
              <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              <p className="text-muted-foreground text-xs truncate">{row.name}</p>
              <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium flex-shrink-0 ${
                row.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {row.status === 'active' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </td>
          {columns.map(col => (
            <td key={col.key} className="p-3 text-right whitespace-nowrap">
              <div className="space-y-0.5">
                <p className="text-muted-foreground text-xs">{col.format((row.metrics as any)[col.key])}</p>
                <DeltaCell row={row} metricKey={col.key} invertDelta={col.invertDelta} />
              </div>
            </td>
          ))}
        </tr>
        {isExpanded && getChildren(row.key, 'adset').map(child => renderRow(child, 2))}
      </Fragment>
    );
  };

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
            {sorted.slice(0, 50).map(row => renderRow(row, 0))}
          </tbody>
        </table>
      </div>
      {sorted.length > 50 && (
        <p className="text-xs text-muted-foreground p-3 text-center">Exibindo 50 de {sorted.length} itens</p>
      )}
    </div>
  );
}
