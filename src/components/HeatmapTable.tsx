import { useMemo, useState, useCallback } from 'react';
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
  { key: 'cpm', label: 'CPM', shortLabel: 'CPM', format: formatCurrency, invertDelta: true, tooltip: 'Custo por mil impressões. Indica competitividade do leilão.' },
  { key: 'landing_page_views', label: 'LPV', shortLabel: 'LPV', format: v => formatNumber(v), tooltip: 'Visualizações da landing page' },
  { key: 'lpv_rate', label: 'LPV Rate', shortLabel: 'LPV%', format: v => formatPercent(v * 100), tooltip: 'LPV / Cliques. Acima de 70% é bom. Abaixo de 50% = cliques "vazios".' },
  { key: 'results', label: 'Resultados', shortLabel: 'Result.', format: v => formatNumber(v), tooltip: 'Conversões registradas' },
  { key: 'cost_per_result', label: 'Custo/Resultado', shortLabel: 'CPA', format: formatCurrency, invertDelta: true, tooltip: 'Custo por resultado. Principal métrica de eficiência.' },
  { key: 'result_per_lpv', label: 'Result/LPV', shortLabel: 'R/LPV', format: v => formatPercent(v * 100), tooltip: 'Resultados / LPV. Taxa de conversão pós-landing page.' },
  { key: 'frequency', label: 'Frequência', shortLabel: 'Freq', format: v => formatNumber(v, 1), tooltip: 'Vezes média que cada pessoa viu o anúncio. Acima de 3 = saturação.' },
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

export default function HeatmapTable() {
  const { state } = useAppState();
  const { current: currentRecords, previous: previousRecords } = useFilteredRecords();
  const { setFilter } = useCrossFilter();
  const [sortKey, setSortKey] = useState<SortKey>('spend_brl');
  const [sortAsc, setSortAsc] = useState(false);
  const [drillPath, setDrillPath] = useState<BreadcrumbLevel[]>([]);

  const currentLevel = drillPath.length === 0
    ? state.analysisLevel
    : drillPath.length === 1
      ? 'adset'
      : 'ad';

  const filteredCurrent = useMemo(() => {
    if (drillPath.length === 0) return currentRecords;
    let filtered = currentRecords;
    for (const crumb of drillPath) {
      if (crumb.level === 'campaign') {
        filtered = filtered.filter(r => (r.campaign_key || 'sem-campanha') === crumb.key);
      } else if (crumb.level === 'adset') {
        filtered = filtered.filter(r => (r.adset_key || 'sem-conjunto') === crumb.key);
      }
    }
    return filtered;
  }, [currentRecords, drillPath]);

  const filteredPrevious = useMemo(() => {
    if (drillPath.length === 0) return previousRecords;
    let filtered = previousRecords;
    for (const crumb of drillPath) {
      if (crumb.level === 'campaign') {
        filtered = filtered.filter(r => (r.campaign_key || 'sem-campanha') === crumb.key);
      } else if (crumb.level === 'adset') {
        filtered = filtered.filter(r => (r.adset_key || 'sem-conjunto') === crumb.key);
      }
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
      // At ad level, emit cross-filter
      setFilter({ level: currentLevel as any, key: row.key, name: row.name });
      return;
    }
    // Emit cross-filter for the entity being drilled into
    setFilter({ level: currentLevel as any, key: row.key, name: row.name });
    setDrillPath(prev => [...prev, { level: currentLevel as 'campaign' | 'adset', key: row.key, name: row.name }]);
    setSortKey('spend_brl');
    setSortAsc(false);
  }, [canDrillDown, currentLevel, setFilter]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    // index = -1 means root
    if (index < 0) {
      setDrillPath([]);
    } else {
      setDrillPath(prev => prev.slice(0, index + 1));
    }
    setSortKey('spend_brl');
    setSortAsc(false);
  }, []);

  if (sorted.length === 0 && drillPath.length === 0) return null;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const nextLevelLabel = currentLevel === 'campaign' ? 'conjuntos' : currentLevel === 'adset' ? 'anúncios' : '';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="glass-card overflow-hidden" data-ranking-table>
        {/* Breadcrumb Navigation */}
        <div className="px-3 py-2 border-b border-border/30 bg-secondary/20">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                {drillPath.length > 0 ? (
                  <BreadcrumbLink
                    className="cursor-pointer flex items-center gap-1 text-xs hover:text-primary transition-colors"
                    onClick={() => handleBreadcrumbClick(-1)}
                  >
                    <Home className="h-3 w-3" />
                    {LEVEL_LABELS[state.analysisLevel]}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="flex items-center gap-1 text-xs font-medium">
                    <Home className="h-3 w-3" />
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
                        <BreadcrumbPage className="text-xs font-medium max-w-[200px] truncate">
                          {crumb.name}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          className="cursor-pointer text-xs hover:text-primary transition-colors max-w-[200px] truncate"
                          onClick={() => handleBreadcrumbClick(i)}
                        >
                          {crumb.name}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                );
              })}

              {drillPath.length > 0 && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      {LEVEL_LABELS[currentLevel]}
                    </span>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Table */}
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
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="p-8 text-center text-muted-foreground text-sm">
                    Nenhum dado encontrado neste nível.
                    {drillPath.length > 0 && (
                      <button
                        className="ml-2 text-primary hover:underline"
                        onClick={() => handleBreadcrumbClick(drillPath.length - 2)}
                      >
                        Voltar
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                sorted.slice(0, 50).map(({ row, verdict }) => (
                  <tr
                    key={row.key}
                    className={`border-b border-border/30 hover:bg-secondary/40 transition-colors ${canDrillDown ? 'cursor-pointer' : ''}`}
                    onClick={canDrillDown ? () => handleDrill(row) : undefined}
                  >
                    <td className="p-2.5 max-w-[200px] sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs text-foreground font-medium">{row.name}</p>
                        {canDrillDown && (
                          <span className="text-[9px] text-muted-foreground/60 whitespace-nowrap">
                            → {nextLevelLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${verdict.color}`}>
                        {verdict.emoji} {verdict.score}
                      </span>
                    </td>
                    {columns.map(col => {
                      const val = (row.metrics as any)[col.key] ?? 0;
                      const heatColor = getHeatmapColor(val, (avgMetrics as any)[col.key], INVERTED_KEYS.has(col.key));
                      const d = row.delta.deltas[col.key];
                      const hasChange = d && d.percent !== null && Math.abs(d.percent) >= 0.5;
                      const positive = d ? (col.invertDelta ? d.absolute < 0 : d.absolute > 0) : null;
                      return (
                        <td key={col.key} className={`p-2.5 text-right whitespace-nowrap ${heatColor}`}>
                          <p className="text-xs text-foreground">{col.format(val)}</p>
                          {hasChange && (
                            <span className={`text-[10px] ${positive ? 'text-positive' : 'text-negative'}`}>
                              {d.percent! > 0 ? '+' : ''}{d.percent!.toFixed(1)}%
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
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
