// ─── Semantic Metric Registry ───
// Single source of truth for all metric definitions, formulas, and formatting

import { formatCurrency, formatNumber, formatPercent } from '../calculations';

export type MetricType = 'sum' | 'ratio' | 'weighted' | 'derived';
export type MetricUnit = 'currency' | 'number' | 'percent' | 'ratio';

export interface MetricDefinition {
  key: string;
  label: string;
  shortLabel?: string;
  type: MetricType;
  unit: MetricUnit;
  /** numerator key for ratio metrics */
  numerator?: string;
  /** denominator key for ratio metrics */
  denominator?: string;
  /** multiplier for ratio (e.g. 100 for %, 1000 for CPM) */
  multiplier?: number;
  /** higher is worse (costs) — inverts delta color */
  invertDelta?: boolean;
  /** dependencies needed to compute */
  dependencies?: string[];
  format: (v: number) => string;
}

export const METRICS: Record<string, MetricDefinition> = {
  // ─── Summable ───
  spend: { key: 'spend', label: 'Investimento', shortLabel: 'Spend', type: 'sum', unit: 'currency', format: formatCurrency },
  impressions: { key: 'impressions', label: 'Impressões', type: 'sum', unit: 'number', format: v => formatNumber(v) },
  reach: { key: 'reach', label: 'Alcance', type: 'sum', unit: 'number', format: v => formatNumber(v) },
  clicks: { key: 'clicks', label: 'Cliques', type: 'sum', unit: 'number', format: v => formatNumber(v) },
  inline_link_clicks: { key: 'inline_link_clicks', label: 'Cliques no Link', shortLabel: 'Link Clicks', type: 'sum', unit: 'number', format: v => formatNumber(v) },
  landing_page_views: { key: 'landing_page_views', label: 'LPV', type: 'sum', unit: 'number', format: v => formatNumber(v) },
  results_leads: { key: 'results_leads', label: 'Leads', type: 'sum', unit: 'number', format: v => formatNumber(v) },
  purchases: { key: 'purchases', label: 'Compras', type: 'sum', unit: 'number', format: v => formatNumber(v) },
  purchase_value: { key: 'purchase_value', label: 'Receita Ads', type: 'sum', unit: 'currency', format: formatCurrency },

  // ─── Ratios (weighted) ───
  ctr_link: { key: 'ctr_link', label: 'CTR Link', type: 'ratio', unit: 'percent', numerator: 'inline_link_clicks', denominator: 'impressions', multiplier: 100, format: v => formatPercent(v) },
  cpc_link: { key: 'cpc_link', label: 'CPC Link', type: 'ratio', unit: 'currency', numerator: 'spend', denominator: 'inline_link_clicks', invertDelta: true, format: formatCurrency },
  cpm: { key: 'cpm', label: 'CPM', type: 'ratio', unit: 'currency', numerator: 'spend', denominator: 'impressions', multiplier: 1000, invertDelta: true, format: formatCurrency },
  frequency: { key: 'frequency', label: 'Frequência', type: 'ratio', unit: 'ratio', numerator: 'impressions', denominator: 'reach', format: v => formatNumber(v, 2) },
  cpa_lead: { key: 'cpa_lead', label: 'CPA Lead', type: 'ratio', unit: 'currency', numerator: 'spend', denominator: 'results_leads', invertDelta: true, format: formatCurrency },
  roas: { key: 'roas', label: 'ROAS', type: 'ratio', unit: 'ratio', numerator: 'purchase_value', denominator: 'spend', format: v => formatNumber(v, 2) },

  // ─── Derived (funnel) ───
  lpv_rate: { key: 'lpv_rate', label: 'Taxa LPV', type: 'derived', unit: 'percent', numerator: 'landing_page_views', denominator: 'inline_link_clicks', multiplier: 100, format: v => formatPercent(v) },
  cost_per_lpv: { key: 'cost_per_lpv', label: 'Custo/LPV', type: 'derived', unit: 'currency', numerator: 'spend', denominator: 'landing_page_views', invertDelta: true, format: formatCurrency },
  lead_per_lpv: { key: 'lead_per_lpv', label: 'Lead/LPV', type: 'derived', unit: 'percent', numerator: 'results_leads', denominator: 'landing_page_views', multiplier: 100, format: v => formatPercent(v) },
};

export const METRIC_KEYS = Object.keys(METRICS);

export function getMetric(key: string): MetricDefinition | undefined {
  return METRICS[key];
}

export function getMetricLabel(key: string): string {
  return METRICS[key]?.label || key;
}

export function formatMetric(key: string, value: number): string {
  const def = METRICS[key];
  if (!def) return String(value);
  return def.format(value);
}
