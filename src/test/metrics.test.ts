import { describe, it, expect } from 'vitest';
import { aggregateInsights, computeDeltas } from '@/lib/metrics/aggregate';
import { explainChange, paretoAnalysis } from '@/lib/metrics/explain';
import { METRICS, getMetricLabel, formatMetric } from '@/lib/metrics/registry';
import type { InsightRow } from '@/lib/metrics/aggregate';

// ─── Test Data ───

function makeRow(overrides: Partial<InsightRow> = {}): InsightRow {
  return {
    spend: 100,
    impressions: 10000,
    reach: 8000,
    clicks: 500,
    inline_link_clicks: 300,
    landing_page_views: 200,
    results_leads: 20,
    purchases: 5,
    purchase_value: 500,
    add_to_cart: 10,
    initiate_checkout: 7,
    ...overrides,
  };
}

// ─── aggregateInsights ───

describe('aggregateInsights', () => {
  it('sums raw metrics correctly', () => {
    const rows = [makeRow({ spend: 100 }), makeRow({ spend: 200 })];
    const result = aggregateInsights(rows);
    expect(result.spend).toBe(300);
    expect(result.impressions).toBe(20000);
    expect(result.clicks).toBe(1000);
  });

  it('computes ratios from sums, not averages', () => {
    const rows = [
      makeRow({ spend: 100, impressions: 1000, inline_link_clicks: 50 }),
      makeRow({ spend: 300, impressions: 3000, inline_link_clicks: 150 }),
    ];
    const result = aggregateInsights(rows);
    // CTR should be (200 / 4000) * 100 = 5%
    expect(result.ctr_link).toBeCloseTo(5.0, 2);
    // CPC should be 400 / 200 = 2
    expect(result.cpc_link).toBeCloseTo(2.0, 2);
    // CPM should be (400 / 4000) * 1000 = 100
    expect(result.cpm).toBeCloseTo(100, 2);
  });

  it('handles empty array', () => {
    const result = aggregateInsights([]);
    expect(result.spend).toBe(0);
    expect(result.ctr_link).toBe(0);
    expect(result.cpm).toBe(0);
  });

  it('handles zero denominators gracefully', () => {
    const rows = [makeRow({ impressions: 0, reach: 0, inline_link_clicks: 0 })];
    const result = aggregateInsights(rows);
    expect(result.ctr_link).toBe(0);
    expect(result.cpc_link).toBe(0);
    expect(result.frequency).toBe(0);
  });

  it('computes ROAS correctly', () => {
    const rows = [makeRow({ spend: 200, purchase_value: 1000 })];
    const result = aggregateInsights(rows);
    expect(result.roas).toBeCloseTo(5.0, 2);
  });

  it('computes CPA lead correctly', () => {
    const rows = [makeRow({ spend: 500, results_leads: 10 })];
    const result = aggregateInsights(rows);
    expect(result.cpa_lead).toBeCloseTo(50, 2);
  });
});

// ─── computeDeltas ───

describe('computeDeltas', () => {
  it('computes absolute and percent deltas', () => {
    const current = aggregateInsights([makeRow({ spend: 200 })]);
    const previous = aggregateInsights([makeRow({ spend: 100 })]);
    const { deltas } = computeDeltas(current, previous);

    expect(deltas.spend.absolute).toBe(100);
    expect(deltas.spend.percent).toBeCloseTo(100, 1);
  });

  it('returns null percent when previous is zero', () => {
    const current = aggregateInsights([makeRow({ spend: 100 })]);
    const previous = aggregateInsights([makeRow({ spend: 0, impressions: 0, reach: 0, clicks: 0, inline_link_clicks: 0, landing_page_views: 0, results_leads: 0, purchases: 0, purchase_value: 0 })]);
    const { deltas } = computeDeltas(current, previous);
    expect(deltas.spend.percent).toBeNull();
  });

  it('handles null previous', () => {
    const current = aggregateInsights([makeRow()]);
    const { deltas } = computeDeltas(current, null);
    expect(deltas.spend.absolute).toBe(100);
    expect(deltas.spend.percent).toBeNull();
  });
});

// ─── explainChange ───

describe('explainChange', () => {
  it('identifies drivers for CPA change', () => {
    const current = aggregateInsights([makeRow({ spend: 200, impressions: 5000, inline_link_clicks: 100, results_leads: 5, landing_page_views: 50 })]);
    const previous = aggregateInsights([makeRow({ spend: 100, impressions: 10000, inline_link_clicks: 300, results_leads: 20, landing_page_views: 200 })]);
    const result = explainChange('cpa_lead', current, previous);

    expect(result.targetMetric).toBe('cpa_lead');
    expect(result.drivers.length).toBeGreaterThan(0);
    expect(result.narrative).toBeTruthy();
    expect(result.changePercent).not.toBe(0);
  });

  it('generates narrative in Portuguese', () => {
    const current = aggregateInsights([makeRow({ spend: 150 })]);
    const previous = aggregateInsights([makeRow({ spend: 100 })]);
    const result = explainChange('cpm', current, previous);
    expect(result.narrative).toMatch(/aumentou|diminuiu/);
  });

  it('handles no significant drivers', () => {
    const current = aggregateInsights([makeRow()]);
    const previous = aggregateInsights([makeRow()]);
    const result = explainChange('cpa_lead', current, previous);
    expect(result.drivers.length).toBe(0);
    expect(result.narrative).toContain('sem drivers');
  });
});

// ─── paretoAnalysis ───

describe('paretoAnalysis', () => {
  it('marks top 80% items correctly', () => {
    const items = [
      { key: 'a', name: 'A', value: 80 },
      { key: 'b', name: 'B', value: 10 },
      { key: 'c', name: 'C', value: 5 },
      { key: 'd', name: 'D', value: 5 },
    ];
    const result = paretoAnalysis(items);
    expect(result[0].key).toBe('a');
    expect(result[0].isTop80).toBe(true);
    expect(result[0].cumulativePercent).toBe(80);
  });

  it('handles empty input', () => {
    expect(paretoAnalysis([])).toEqual([]);
  });
});

// ─── Registry ───

describe('Metric Registry', () => {
  it('has required metrics defined', () => {
    expect(METRICS.spend).toBeDefined();
    expect(METRICS.ctr_link).toBeDefined();
    expect(METRICS.cpa_lead).toBeDefined();
    expect(METRICS.roas).toBeDefined();
  });

  it('getMetricLabel returns label', () => {
    expect(getMetricLabel('spend')).toBe('Investimento');
    expect(getMetricLabel('unknown')).toBe('unknown');
  });

  it('formatMetric formats correctly', () => {
    const formatted = formatMetric('spend', 1234.5);
    expect(formatted).toContain('1.234');
  });

  it('ratio metrics have numerator and denominator', () => {
    const ratios = Object.values(METRICS).filter(m => m.type === 'ratio');
    for (const m of ratios) {
      expect(m.numerator).toBeTruthy();
      expect(m.denominator).toBeTruthy();
    }
  });
});
