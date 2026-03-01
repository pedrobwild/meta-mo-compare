// ─── Correct Aggregation Engine ───
// All ratios are computed from sums, never averaged

import { METRICS, type MetricDefinition } from './registry';

export interface InsightRow {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  inline_link_clicks: number;
  landing_page_views: number;
  results_leads: number;
  purchases: number;
  purchase_value: number;
  add_to_cart?: number;
  initiate_checkout?: number;
  [key: string]: any;
}

export interface AggregatedResult {
  [key: string]: number;
}

const SUM_KEYS = [
  'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
  'landing_page_views', 'results_leads', 'purchases', 'purchase_value',
  'add_to_cart', 'initiate_checkout',
];

export function aggregateInsights(rows: InsightRow[]): AggregatedResult {
  const sums: AggregatedResult = {};

  // Step 1: Sum all summable metrics
  for (const key of SUM_KEYS) {
    sums[key] = 0;
  }
  for (const row of rows) {
    for (const key of SUM_KEYS) {
      sums[key] += Number(row[key]) || 0;
    }
  }

  // Step 2: Compute ratios from sums
  const result: AggregatedResult = { ...sums };

  for (const [key, def] of Object.entries(METRICS)) {
    if (def.type === 'ratio' || def.type === 'derived') {
      const num = sums[def.numerator!] || 0;
      const den = sums[def.denominator!] || 0;
      const mult = def.multiplier || 1;
      result[key] = den > 0 ? (num / den) * mult : 0;
    }
  }

  return result;
}

export interface DeltaResult {
  current: AggregatedResult;
  previous: AggregatedResult | null;
  deltas: Record<string, { absolute: number; percent: number | null }>;
}

export function computeDeltas(current: AggregatedResult, previous: AggregatedResult | null): DeltaResult {
  const deltas: Record<string, { absolute: number; percent: number | null }> = {};

  for (const key of Object.keys(current)) {
    const curr = current[key] || 0;
    const prev = previous ? (previous[key] || 0) : 0;
    const absolute = curr - prev;
    const percent = prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;
    deltas[key] = { absolute, percent };
  }

  return { current, previous, deltas };
}
