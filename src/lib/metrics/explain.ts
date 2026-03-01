// ─── Delta Decomposition & Driver Analysis ───
// When CPA worsens, decompose by CPM/CTR/CVR to find root cause

import { METRICS } from './registry';
import type { AggregatedResult } from './aggregate';

export interface Driver {
  key: string;
  label: string;
  current: number;
  previous: number;
  percentChange: number;
  absoluteChange: number;
  impact: 'positive' | 'negative' | 'neutral';
  contribution: number; // 0-1 estimated contribution to parent change
}

export interface ExplainResult {
  targetMetric: string;
  targetLabel: string;
  changePercent: number;
  drivers: Driver[];
  narrative: string;
}

// Which metrics are the "drivers" for common targets
const DRIVER_MAP: Record<string, string[]> = {
  cpa_lead: ['cpm', 'ctr_link', 'lpv_rate', 'lead_per_lpv'],
  cost_per_lpv: ['cpm', 'ctr_link', 'lpv_rate'],
  cpc_link: ['cpm', 'ctr_link'],
  roas: ['cpa_lead', 'purchase_value', 'purchases'],
  spend: ['impressions', 'cpm'],
};

const EFFICIENCY_DRIVERS = ['cpm', 'ctr_link', 'cpc_link', 'lpv_rate', 'lead_per_lpv', 'cpa_lead', 'frequency', 'roas'];

export function explainChange(
  targetMetric: string,
  current: AggregatedResult,
  previous: AggregatedResult
): ExplainResult {
  const def = METRICS[targetMetric];
  const label = def?.label || targetMetric;
  const currVal = current[targetMetric] || 0;
  const prevVal = previous[targetMetric] || 0;
  const changePercent = prevVal !== 0 ? ((currVal - prevVal) / Math.abs(prevVal)) * 100 : 0;

  const driverKeys = DRIVER_MAP[targetMetric] || EFFICIENCY_DRIVERS;
  const invertKeys = new Set(
    Object.entries(METRICS)
      .filter(([_, d]) => d.invertDelta)
      .map(([k]) => k)
  );

  const drivers: Driver[] = [];

  for (const key of driverKeys) {
    const c = current[key] || 0;
    const p = previous[key] || 0;
    if (p === 0 && c === 0) continue;

    const pctChange = p !== 0 ? ((c - p) / Math.abs(p)) * 100 : 0;
    if (Math.abs(pctChange) < 0.5) continue;

    const isInverted = invertKeys.has(key);
    const isPositive = isInverted ? c < p : c > p;

    drivers.push({
      key,
      label: METRICS[key]?.label || key,
      current: c,
      previous: p,
      percentChange: pctChange,
      absoluteChange: c - p,
      impact: Math.abs(pctChange) < 1 ? 'neutral' : isPositive ? 'positive' : 'negative',
      contribution: 0,
    });
  }

  // Estimate contribution (simple proportional)
  const totalAbsChange = drivers.reduce((s, d) => s + Math.abs(d.percentChange), 0);
  if (totalAbsChange > 0) {
    for (const d of drivers) {
      d.contribution = Math.abs(d.percentChange) / totalAbsChange;
    }
  }

  // Sort by contribution desc
  drivers.sort((a, b) => b.contribution - a.contribution);

  // Generate narrative
  const narrative = generateNarrative(targetMetric, label, changePercent, drivers);

  return { targetMetric, targetLabel: label, changePercent, drivers, narrative };
}

function generateNarrative(metric: string, label: string, change: number, drivers: Driver[]): string {
  const direction = change > 0 ? 'aumentou' : 'diminuiu';
  const absChange = Math.abs(change).toFixed(1);

  if (drivers.length === 0) {
    return `${label} ${direction} ${absChange}% sem drivers significativos identificados.`;
  }

  const topDrivers = drivers.slice(0, 3);
  const parts = topDrivers.map(d => {
    const dir = d.percentChange > 0 ? '↑' : '↓';
    return `${d.label} ${dir}${Math.abs(d.percentChange).toFixed(1)}%`;
  });

  return `${label} ${direction} ${absChange}%, impulsionado por: ${parts.join(', ')}.`;
}

// ─── Pareto Analysis: find sub-dimensions explaining 80% of variation ───

export interface ParetoItem {
  key: string;
  name: string;
  value: number;
  cumulativePercent: number;
  isTop80: boolean;
}

export function paretoAnalysis(
  items: { key: string; name: string; value: number }[],
  ascending = false
): ParetoItem[] {
  const sorted = [...items].sort((a, b) => ascending ? a.value - b.value : b.value - a.value);
  const total = sorted.reduce((s, i) => s + Math.abs(i.value), 0);
  
  let cumulative = 0;
  return sorted.map(item => {
    cumulative += Math.abs(item.value);
    const cumulativePercent = total > 0 ? (cumulative / total) * 100 : 0;
    return {
      ...item,
      cumulativePercent,
      isTop80: cumulativePercent <= 80 || cumulative === Math.abs(item.value),
    };
  });
}
