import type { MetaRecord, AggregatedMetrics, DeltaMetrics, AnalysisLevel, TruthSource, FunnelData, PeriodGranularity, PeriodKey } from './types';

export function aggregateMetrics(records: MetaRecord[]): AggregatedMetrics {
  const sum = (fn: (r: MetaRecord) => number) => records.reduce((acc, r) => acc + fn(r), 0);

  const spend_brl = sum(r => r.spend_brl);
  const impressions = sum(r => r.impressions);
  const link_clicks = sum(r => r.link_clicks);
  const clicks_all = sum(r => r.clicks_all);
  const results = sum(r => r.results);
  const reach = sum(r => r.reach);
  const landing_page_views = sum(r => r.landing_page_views);

  return {
    spend_brl,
    impressions,
    link_clicks,
    clicks_all,
    results,
    reach,
    landing_page_views,
    ctr_link: impressions > 0 ? (link_clicks / impressions) * 100 : 0,
    cpc_link: link_clicks > 0 ? spend_brl / link_clicks : 0,
    cpm: impressions > 0 ? (spend_brl / impressions) * 1000 : 0,
    cost_per_result: results > 0 ? spend_brl / results : 0,
    cost_per_lpv: landing_page_views > 0 ? spend_brl / landing_page_views : 0,
    frequency: reach > 0 ? impressions / reach : 0,
    ctr_all: impressions > 0 ? (clicks_all / impressions) * 100 : 0,
    cpc_all: clicks_all > 0 ? spend_brl / clicks_all : 0,
    // Derived metrics
    lpv_rate: link_clicks > 0 ? landing_page_views / link_clicks : 0,
    qualified_ctr: impressions > 0 ? (landing_page_views / impressions) * 100 : 0,
    result_per_lpv: landing_page_views > 0 ? results / landing_page_views : 0,
  };
}

export function computeDeltas(current: AggregatedMetrics, previous: AggregatedMetrics | null): DeltaMetrics {
  const deltas: Record<string, { absolute: number; percent: number | null }> = {};
  const keys = Object.keys(current) as (keyof AggregatedMetrics)[];

  for (const key of keys) {
    const curr = current[key];
    const prev = previous ? previous[key] : 0;
    const absolute = curr - prev;
    const percent = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;
    deltas[key] = { absolute, percent };
  }

  return { current, previous, deltas };
}

// === Period-based filtering ===

export function filterRecordsByPeriod(
  records: MetaRecord[],
  periodKey: string,
  truthSource: TruthSource
): MetaRecord[] {
  return records.filter(r => r.period_key === periodKey && r.source_type === truthSource);
}

export function filterByPeriodWithFallback(
  records: MetaRecord[],
  periodKey: string,
  truthSource: TruthSource
): MetaRecord[] {
  let filtered = records.filter(r => r.period_key === periodKey && r.source_type === truthSource);
  if (filtered.length === 0) {
    filtered = records.filter(r => r.period_key === periodKey);
  }
  return filtered;
}

// Legacy month-based (kept for compatibility during migration)
export function filterByTruthSourceWithFallback(
  records: MetaRecord[],
  monthKey: string,
  truthSource: TruthSource
): MetaRecord[] {
  let filtered = records.filter(r => r.month_key === monthKey && r.source_type === truthSource);
  if (filtered.length === 0) {
    filtered = records.filter(r => r.month_key === monthKey);
  }
  return filtered;
}

export interface GroupedRow {
  key: string;
  name: string;
  metrics: AggregatedMetrics;
  previousMetrics: AggregatedMetrics | null;
  delta: DeltaMetrics;
  records: MetaRecord[];
}

export function groupByLevel(
  currentRecords: MetaRecord[],
  previousRecords: MetaRecord[],
  level: AnalysisLevel,
  searchQuery: string,
  includeInactive: boolean
): GroupedRow[] {
  const getKey = (r: MetaRecord) => {
    switch (level) {
      case 'campaign': return r.campaign_key || 'sem-campanha';
      case 'adset': return r.adset_key || 'sem-conjunto';
      case 'ad': return r.ad_key;
    }
  };

  const getName = (r: MetaRecord) => {
    switch (level) {
      case 'campaign': return r.campaign_name || 'Sem Campanha';
      case 'adset': return r.adset_name || 'Sem Conjunto';
      case 'ad': return r.ad_name;
    }
  };

  const currentGroups = new Map<string, MetaRecord[]>();
  for (const r of currentRecords) {
    const key = getKey(r);
    if (!currentGroups.has(key)) currentGroups.set(key, []);
    currentGroups.get(key)!.push(r);
  }

  const prevGroups = new Map<string, MetaRecord[]>();
  for (const r of previousRecords) {
    const key = getKey(r);
    if (!prevGroups.has(key)) prevGroups.set(key, []);
    prevGroups.get(key)!.push(r);
  }

  const rows: GroupedRow[] = [];
  for (const [key, recs] of currentGroups) {
    const metrics = aggregateMetrics(recs);
    if (!includeInactive && metrics.spend_brl === 0 && metrics.impressions === 0) continue;

    const name = getName(recs[0]);
    if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) continue;

    const prevRecs = prevGroups.get(key) || [];
    const previousMetrics = prevRecs.length > 0 ? aggregateMetrics(prevRecs) : null;
    const delta = computeDeltas(metrics, previousMetrics);

    rows.push({ key, name, metrics, previousMetrics, delta, records: recs });
  }

  return rows.sort((a, b) => b.metrics.spend_brl - a.metrics.spend_brl);
}

export function computeFunnel(
  funnel: FunnelData | undefined,
  metrics: AggregatedMetrics
) {
  if (!funnel) return null;

  const { mql, sql, vendas, receita } = funnel;
  const { link_clicks, spend_brl } = metrics;

  return {
    mql,
    sql,
    vendas,
    receita,
    click_to_mql: link_clicks > 0 ? mql / link_clicks : 0,
    mql_to_sql: mql > 0 ? sql / mql : 0,
    sql_to_vendas: sql > 0 ? vendas / sql : 0,
    ticket_medio: vendas > 0 ? receita / vendas : 0,
    cac_midia: vendas > 0 ? spend_brl / vendas : 0,
    roas: spend_brl > 0 ? receita / spend_brl : 0,
  };
}

// === Period utilities ===

export function getAvailablePeriods(records: MetaRecord[], granularity?: PeriodGranularity): string[] {
  const filtered = granularity ? records.filter(r => r.granularity === granularity) : records;
  const periods = [...new Set(filtered.map(r => r.period_key))];
  return periods.sort().reverse();
}

export function getAvailableGranularities(records: MetaRecord[]): PeriodGranularity[] {
  const granularities = new Set(records.map(r => r.granularity));
  const result: PeriodGranularity[] = [];
  if (granularities.has('day')) result.push('day');
  if (granularities.has('week')) result.push('week');
  return result;
}

export function detectDefaultGranularity(records: MetaRecord[]): PeriodGranularity {
  const hasDay = records.some(r => r.granularity === 'day');
  return hasDay ? 'day' : 'week';
}

export function getPreviousPeriod(periodKey: string, granularity: PeriodGranularity): string {
  if (granularity === 'day') {
    const d = new Date(periodKey);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  // Date range format: "YYYY-MM-DD_YYYY-MM-DD"
  const rangeParts = periodKey.split('_');
  if (rangeParts.length === 2) {
    const start = new Date(rangeParts[0] + 'T00:00:00');
    const end = new Date(rangeParts[1] + 'T00:00:00');
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    return `${prevStart.toISOString().slice(0, 10)}_${prevEnd.toISOString().slice(0, 10)}`;
  }
  // Legacy week format
  const match = periodKey.match(/^(\d{4})-W(\d{2})$/);
  if (match) {
    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    if (week <= 1) return `${year - 1}-W52`;
    return `${year}-W${String(week - 1).padStart(2, '0')}`;
  }
  return periodKey;
}

// Legacy
export function getAvailableMonths(records: MetaRecord[]): string[] {
  const months = [...new Set(records.map(r => r.month_key))].filter(m => m !== 'unknown');
  return months.sort().reverse();
}

export function getPreviousMonth(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(value);
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function getPeriodLabel(periodKey: string, granularity: PeriodGranularity): string {
  if (granularity === 'day') {
    const d = new Date(periodKey + 'T00:00:00');
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  // Date range format: "YYYY-MM-DD_YYYY-MM-DD"
  const rangeParts = periodKey.split('_');
  if (rangeParts.length === 2) {
    const formatDate = (iso: string) => {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };
    return `${formatDate(rangeParts[0])} - ${formatDate(rangeParts[1])}`;
  }
  // Legacy week format "YYYY-Www"
  const match = periodKey.match(/^(\d{4})-W(\d{2})$/);
  if (match) {
    return `Sem ${match[2]}/${match[1]}`;
  }
  return periodKey;
}

export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[month - 1]} ${year}`;
}

// Metric definitions for display
export interface MetricDef {
  key: string;
  label: string;
  format: (v: number) => string;
  invertDelta?: boolean;
}

export const METRIC_DEFS: MetricDef[] = [
  { key: 'spend_brl', label: 'Investimento', format: formatCurrency },
  { key: 'impressions', label: 'Impressões', format: v => formatNumber(v) },
  { key: 'link_clicks', label: 'Cliques no Link', format: v => formatNumber(v) },
  { key: 'ctr_link', label: 'CTR Link', format: v => formatPercent(v) },
  { key: 'cpc_link', label: 'CPC Link', format: formatCurrency, invertDelta: true },
  { key: 'cpm', label: 'CPM', format: formatCurrency, invertDelta: true },
  { key: 'results', label: 'Resultados', format: v => formatNumber(v) },
  { key: 'cost_per_result', label: 'Custo/Resultado', format: formatCurrency, invertDelta: true },
  { key: 'landing_page_views', label: 'LPV', format: v => formatNumber(v) },
  { key: 'cost_per_lpv', label: 'Custo/LPV', format: formatCurrency, invertDelta: true },
  { key: 'reach', label: 'Alcance', format: v => formatNumber(v) },
  { key: 'frequency', label: 'Frequência', format: v => formatNumber(v, 2) },
  { key: 'lpv_rate', label: 'LPV Rate', format: v => formatPercent(v * 100) },
  { key: 'qualified_ctr', label: 'Qualified CTR', format: v => formatPercent(v) },
  { key: 'result_per_lpv', label: 'Result/LPV', format: v => formatPercent(v * 100) },
];

// Identify top drivers of change between periods
export interface DriverChange {
  key: string;
  label: string;
  current: number;
  previous: number;
  percentChange: number;
  absoluteChange: number;
  impact: 'positive' | 'negative';
}

export function identifyDrivers(delta: DeltaMetrics, limit = 5): DriverChange[] {
  const driverKeys = ['cpm', 'ctr_link', 'cpc_link', 'lpv_rate', 'cost_per_result', 'cost_per_lpv', 'qualified_ctr', 'result_per_lpv', 'frequency'];
  const invertKeys = new Set(['cpm', 'cpc_link', 'cost_per_result', 'cost_per_lpv']);

  if (!delta.previous) return [];

  const drivers: DriverChange[] = [];
  for (const key of driverKeys) {
    const d = delta.deltas[key];
    if (!d || d.percent === null || Math.abs(d.percent) < 1) continue;

    const def = METRIC_DEFS.find(m => m.key === key);
    const isInverted = invertKeys.has(key);
    const isPositive = isInverted ? d.absolute < 0 : d.absolute > 0;

    drivers.push({
      key,
      label: def?.label || key,
      current: delta.current[key as keyof AggregatedMetrics],
      previous: delta.previous[key as keyof AggregatedMetrics],
      percentChange: d.percent,
      absoluteChange: d.absolute,
      impact: isPositive ? 'positive' : 'negative',
    });
  }

  return drivers.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)).slice(0, limit);
}
