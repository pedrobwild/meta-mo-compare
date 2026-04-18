import { useMemo, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { useCrossFilter } from '@/lib/crossFilter';
import {
  aggregateMetrics,
  groupByLevel,
  formatCurrency,
  formatNumber,
  formatPercent,
  type GroupedRow,
} from '@/lib/calculations';
import { computeVerdict, getHeatmapColor, type VerdictResult } from '@/lib/insights/verdicts';
import { ChevronDown, ChevronUp, Info, Home } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

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
  { key: 'cpm', label: 'CPM', shortLabel: 'CPM', format: formatCurrency, invertDelta: true, tooltip: 'Custo por mil impressões.' },
  { key: 'landing_page_views', label: 'LPV', shortLabel: 'LPV', format: v => formatNumber(v), tooltip: 'Visualizações da landing page' },
  { key: 'lpv_rate', label: 'LPV Rate', shortLabel: 'LPV%', format: v => formatPercent(v * 100), tooltip: 'LPV / Cliques. Acima de 70% é bom.' },
  { key: 'results', label: 'Resultados', shortLabel: 'Result.', format: v => formatNumber(v), tooltip: 'Conversões registradas' },
  { key: 'cost_per_result', label: 'Custo/Resultado', shortLabel: 'CPA', format: formatCurrency, invertDelta: true, tooltip: 'Custo por resultado.' },
  { key: 'result_per_lpv', label: 'Result/LPV', shortLabel: 'R/LPV', format: v => formatPercent(v * 100), tooltip: 'Resultados / LPV.' },
  { key: 'frequency', label: 'Frequência', shortLabel: 'Freq', format: v => formatNumber(v, 1), tooltip: 'Vezes média que cada pessoa viu o anúncio.' },
];

const INVERTED_KEYS = new Set(['cpc_link', 'cpm', 'cost_per_result', 'cost_per_lpv', 'frequency']);

interface BreadcrumbLevel {
  level: 'campaign' | 'adset' | 'ad';
  key: string;
  name: string;
}

const LEVEL_LABELS: Record<string, string> = {
  campaign: 'Campanhas',
  adset: 'Conjuntos',
  ad: 'Anúncios',
};

// Verdict pill styles
function VerdictPill({ verdict }: { verdict: VerdictResult }) {
  const styles: Record<string, string> = {
    scale: 'bg-positive/10 text-positive',
    keep: 'bg-primary/10 text-primary',
    test_variation: 'bg-warning/10 text-warning',
    watch: 'bg-warning/10 text-warning',
    pause: 'bg-negative/10 text-negative',
  };
  const labels: Record<string, string> = {
    scale: 'ESCALAR',
    keep: 'MANTER',
    test_variation: 'REVISAR',
    watch: 'REVISAR',
    pause: 'PAUSAR',
  };
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-meta-pill text-[10px] font-bold uppercase tracking-wider ${styles[verdict.verdict] || styles.watch}`}>
      {labels[verdict.verdict] || verdict.label}
    </span>
  );
}

// Score display
function ScoreDisplay({ verdict }: { verdict: VerdictResult }) {
  const colorClass = verdict.score >= 80
    ? 'text-positive'
    : verdict.score >= 60
      ? 'text-warning'
      : 'text-destructive';

  return (
    <div className="text-center space-y-1">
      <p className={`text-lg font-bold ${colorClass}`}>{verdict.score}</p>
      <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            verdict.score >= 80 ? 'bg-positive' : verdict.score >= 60 ? 'bg-warning' : 'bg-destructive'
          }`}
          style={{ width: `${verdict.score}%` }}
        />
      </div>
      <VerdictPill verdict={verdict} />
    </div>
  );
}

export default function HeatmapTable() {
  const { state } = useAppState();
  const { current: currentRecords, previous: previousRecords } = useFilteredRecords();
  const { setFilter } = useCrossFilter();
  const [sortKey, setSortKey] = useState<SortKey>('spend_brl');
  const [sortAsc, setSortAsc] = useState(false);
  const [drillPath, setDrillPath] = useState<BreadcrumbLevel[]>([]);

  const currentLevel = drillPath.length === 0
    ? state.analysisLevel
    : drillPath.length === 1 ? 'adset' : 'ad';

  const filteredCurrent = useMemo(() => {
    if (drillPath.length === 0) return currentRecords;
    let filtered = currentRecords;
    for (const crumb of drillPath) {
      if (crumb.level === 'campaign') filtered = filtered.filter(r => (r.campaign_key || 'sem-campanha') === crumb.key);
      else if (crumb.level === 'adset') filtered = filtered.filter(r => (r.adset_key || 'sem-conjunto') === crumb.key);
    }
    return filtered;
  }, [currentRecords, drillPath]);

  const filteredPrevious = useMemo(() => {
    if (drillPath.length === 0) return previousRecords;
    let filtered = previousRecords;
    for (const crumb of drillPath) {
      if (crumb.level === 'campaign') filtered = filtered.filter(r => (r.campaign_key || 'sem-campanha') === crumb.key);
      else if (crumb.level === 'adset') filtered = filtered.filter(r => (r.adset_key || 'sem-conjunto') === crumb.key);
    }
    return filtered;
  }, [previousRecords, drillPath]);

  const avgMetrics = useMemo(() => aggregateMetrics(filteredCurrent), [filteredCurrent]);

  const rows = useMemo(() => {
    if (filteredCurrent.length === 0) return [];
    return groupByLevel(filteredCurrent, filteredPrevious, currentLevel as any, state.searchQuery, state.includeInactive);
  }, [filteredCurrent, filteredPrevious, currentLevel, state.searchQuery, state.includeInactive]);

  const rowsWithVerdicts = useMemo(() => {
    return rows.map(row => ({ row, verdict: computeVerdict(row, avgMetrics) }));
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

  const canDrillDown = currentLevel !== 'ad';

  const handleDrill = useCallback((row: GroupedRow) => {
    if (!canDrillDown) {
      setFilter({ level: currentLevel as any, key: row.key, name: row.name });
      return;
    }
    setFilter({ level: currentLevel as any, key: row.key, name: row.name });
    setDrillPath(prev => [...prev, { level: currentLevel as 'campaign' | 'adset', key: row.key, name: row.name }]);
    setSortKey('spend_brl');
    setSortAsc(false);
  }, [canDrillDown, currentLevel, setFilter]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    if (index < 0) setDrillPath([]);
    else setDrillPath(prev => prev.slice(0, index + 1));
    setSortKey('spend_brl');
    setSortAsc(false);
  }, []);

  // Virtualize only when the sorted list is large. Below the threshold, the
  // classic table markup is fine and keeps sticky columns / headers dead
  // simple; above it, we switch to a fixed-height scrollable body.
  //
  // These hooks must stay ABOVE the early `return null` so hook order is
  // stable across renders (rules-of-hooks).
  const ROW_HEIGHT = 64;
  const VIRTUAL_THRESHOLD = 50;
  const shouldVirtualize = sorted.length > VIRTUAL_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (sorted.length === 0 && drillPath.length === 0) return null;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const nextLevelLabel = currentLevel === 'campaign' ? 'conjuntos' : currentLevel === 'adset' ? 'anúncios' : '';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-card border border-border rounded-meta-card overflow-hidden shadow-meta-subtle" data-ranking-table>
        {/* Breadcrumb */}
        <div className="px-4 py-2.5 border-b border-border bg-secondary/30">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                {drillPath.length > 0 ? (
                  <BreadcrumbLink
                    className="cursor-pointer flex items-center gap-1 text-meta-caption hover:text-primary transition-colors"
                    onClick={() => handleBreadcrumbClick(-1)}
                  >
                    <Home className="h-3 w-3" strokeWidth={1.5} />
                    {LEVEL_LABELS[state.analysisLevel]}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="flex items-center gap-1 text-meta-caption font-semibold">
                    <Home className="h-3 w-3" strokeWidth={1.5} />
                    {LEVEL_LABELS[state.analysisLevel]}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {drillPath.map((crumb, i) => {
                const isLast = i === drillPath.length - 1;
                return (
                  <span key={crumb.key} className="contents">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage className="text-meta-caption font-semibold max-w-[200px] truncate">{crumb.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink className="cursor-pointer text-meta-caption hover:text-primary max-w-[200px] truncate" onClick={() => handleBreadcrumbClick(i)}>{crumb.name}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                );
              })}
              {drillPath.length > 0 && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span className="meta-section-label">{LEVEL_LABELS[currentLevel]}</span>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Table */}
        {(() => {
          const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];
          const totalSize = shouldVirtualize ? virtualizer.getTotalSize() : 0;
          const topPad = virtualItems.length > 0 ? virtualItems[0].start : 0;
          const bottomPad =
            virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;
          const visible = shouldVirtualize
            ? virtualItems.map((vi) => sorted[vi.index])
            : sorted;

          const renderRow = ({ row, verdict }: { row: GroupedRow; verdict: VerdictResult }) => (
            <tr
              key={row.key}
              className={`border-b border-border hover:bg-secondary/40 transition-colors duration-100 ${canDrillDown ? 'cursor-pointer' : ''}`}
              onClick={canDrillDown ? () => handleDrill(row) : undefined}
              style={{ height: `${ROW_HEIGHT}px` }}
            >
              <td className="px-3 max-w-[240px] sticky left-0 bg-card z-10">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-meta-body font-semibold text-foreground">{row.name}</p>
                  {canDrillDown && (
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">→ {nextLevelLabel}</span>
                  )}
                </div>
              </td>
              <td className="px-3 text-center">
                <ScoreDisplay verdict={verdict} />
              </td>
              {columns.map((col) => {
                const val = (row.metrics as any)[col.key] ?? 0;
                const heatColor = getHeatmapColor(val, (avgMetrics as any)[col.key], INVERTED_KEYS.has(col.key));
                const d = row.delta.deltas[col.key];
                const hasChange = d && d.percent !== null && Math.abs(d.percent) >= 0.5;
                const positive = d ? (col.invertDelta ? d.absolute < 0 : d.absolute > 0) : null;
                return (
                  <td key={col.key} className={`px-3 text-right whitespace-nowrap ${heatColor}`}>
                    <p className="text-meta-body text-foreground">{col.format(val)}</p>
                    {hasChange && (
                      <span className={`text-[10px] font-medium ${positive ? 'text-positive' : 'text-negative'}`}>
                        {d.percent! > 0 ? '+' : ''}{d.percent!.toFixed(1)}%
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          );

          return (
            <div
              ref={scrollRef}
              className="overflow-auto"
              style={shouldVirtualize ? { maxHeight: '70vh' } : undefined}
            >
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-20 bg-secondary/40 backdrop-blur-sm">
                  <tr className="border-b-2 border-border">
                    <th className="text-left p-3 text-meta-label text-muted-foreground font-medium cursor-pointer hover:text-foreground sticky left-0 bg-secondary/40 z-30 min-w-[200px]"
                      onClick={() => toggleSort('name')}>
                      <span className="flex items-center gap-1">Nome <SortIcon col="name" /></span>
                    </th>
                    <th className="text-center p-3 text-meta-label text-muted-foreground font-medium cursor-pointer hover:text-foreground min-w-[80px]"
                      onClick={() => toggleSort('verdict')}>
                      <span className="flex items-center justify-center gap-1">Score <SortIcon col="verdict" /></span>
                    </th>
                    {columns.map((col) => (
                      <th key={col.key}
                        className="text-right p-3 text-meta-label text-muted-foreground font-medium cursor-pointer hover:text-foreground whitespace-nowrap"
                        onClick={() => toggleSort(col.key)}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center justify-end gap-1">
                              {col.shortLabel} <SortIcon col={col.key} />
                              <Info className="h-3 w-3 opacity-30" strokeWidth={1.5} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] rounded-meta-card shadow-meta-card">
                            <p className="text-meta-caption">{col.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 2} className="p-12 text-center">
                        <p className="text-meta-heading-sm text-foreground mb-1">Nenhum dado encontrado</p>
                        <p className="text-meta-body text-muted-foreground">
                          {drillPath.length > 0 ? (
                            <button className="text-primary hover:underline" onClick={() => handleBreadcrumbClick(drillPath.length - 2)}>
                              Voltar ao nível anterior
                            </button>
                          ) : 'Ajuste os filtros para ver resultados'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {shouldVirtualize && topPad > 0 && (
                        <tr aria-hidden style={{ height: `${topPad}px` }}>
                          <td colSpan={columns.length + 2} />
                        </tr>
                      )}
                      {visible.map(renderRow)}
                      {shouldVirtualize && bottomPad > 0 && (
                        <tr aria-hidden style={{ height: `${bottomPad}px` }}>
                          <td colSpan={columns.length + 2} />
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
        {sorted.length > 0 && (
          <div className="px-4 py-2 border-t border-border flex items-center justify-between text-meta-caption text-muted-foreground">
            <span>
              {shouldVirtualize
                ? `${sorted.length} itens · virtualização ativa`
                : `${sorted.length} itens`}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
