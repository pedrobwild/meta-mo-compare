import { describe, it, expect } from 'vitest';
import { generateInsights } from '@/lib/insights/rules';
import type { AggregatedMetrics, DeltaMetrics, LeadQualityMetrics, CreativeLifecycleRecord } from '@/lib/types';
import type { GroupedRow } from '@/lib/calculations';

// ── Helpers ──────────────────────────────────────────

function makeMetrics(overrides: Partial<AggregatedMetrics> = {}): AggregatedMetrics {
  return {
    spend_brl: 1000, impressions: 50000, link_clicks: 500, clicks_all: 600,
    results: 20, reach: 30000, landing_page_views: 400,
    ctr_link: 1.0, cpc_link: 2.0, cpm: 20, cost_per_result: 50,
    cost_per_lpv: 2.5, frequency: 1.7, ctr_all: 1.2, cpc_all: 1.67,
    lpv_rate: 0.8, qualified_ctr: 0.008, result_per_lpv: 0.05,
    ...overrides,
  };
}

function makeDelta(current: AggregatedMetrics, previous: AggregatedMetrics | null, deltaOverrides: Record<string, { absolute: number; percent: number | null }> = {}): DeltaMetrics {
  const deltas: Record<string, { absolute: number; percent: number | null }> = {};
  if (previous) {
    for (const key of Object.keys(current) as (keyof AggregatedMetrics)[]) {
      const c = current[key] as number;
      const p = previous[key] as number;
      deltas[key] = { absolute: c - p, percent: p !== 0 ? ((c - p) / Math.abs(p)) * 100 : null };
    }
  }
  Object.assign(deltas, deltaOverrides);
  return { current, previous, deltas };
}

function makeRow(key: string, name: string, metricsOverrides: Partial<AggregatedMetrics> = {}): GroupedRow {
  const metrics = makeMetrics(metricsOverrides);
  return {
    key, name, metrics,
    previousMetrics: null,
    delta: makeDelta(metrics, null),
    records: [],
    status: 'active' as const,
  };
}

function makeLQ(overrides: Partial<LeadQualityMetrics> = {}): LeadQualityMetrics {
  return {
    campaign_key: 'c1', leads_total: 100, taxa_atendimento: 0.6,
    taxa_qualificacao: 0.4, taxa_agendamento: 0.2, taxa_fechamento: 0.1,
    cpa_reuniao: 50, cpa_contrato: 100, roas_real: 2.0,
    receita_por_lead: 20, receita_brl: 2000, contratos_fechados: 10,
    ...overrides,
  };
}

function makeCreative(overrides: Partial<CreativeLifecycleRecord> = {}): CreativeLifecycleRecord {
  return {
    id: 'cr1', workspace_id: 'w1', ad_key: 'ad1', ad_name: 'Ad Test',
    days_active: 12, peak_ctr: 0.05, current_ctr: 0.03,
    degradation_pct: 40, status: 'active',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────

describe('Insight Rules I9–I16', () => {

  describe('I9: Lead No-Show', () => {
    it('fires when taxa_atendimento < 40% and spend > 200', () => {
      const metrics = makeMetrics({ spend_brl: 500 });
      const lq = makeLQ({ leads_total: 50, taxa_atendimento: 0.30 });
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, [], lq);
      expect(insights.some(i => i.id === 'i9-lead-no-show')).toBe(true);
    });

    it('does NOT fire when taxa_atendimento >= 40%', () => {
      const metrics = makeMetrics({ spend_brl: 500 });
      const lq = makeLQ({ leads_total: 50, taxa_atendimento: 0.50 });
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, [], lq);
      expect(insights.some(i => i.id === 'i9-lead-no-show')).toBe(false);
    });

    it('does NOT fire when leads_total < 20', () => {
      const metrics = makeMetrics({ spend_brl: 500 });
      const lq = makeLQ({ leads_total: 10, taxa_atendimento: 0.10 });
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, [], lq);
      expect(insights.some(i => i.id === 'i9-lead-no-show')).toBe(false);
    });
  });

  describe('I10: ROAS Inversion', () => {
    it('fires when best CPA row differs from best ROAS row', () => {
      const rows = [
        makeRow('c1', 'Campaign A', { cost_per_result: 10 }),
        makeRow('c2', 'Campaign B', { cost_per_result: 20 }),
      ];
      const lqByKey: Record<string, LeadQualityMetrics> = {
        c1: makeLQ({ campaign_key: 'c1', roas_real: 1.5 }),
        c2: makeLQ({ campaign_key: 'c2', roas_real: 4.0 }),
      };
      const metrics = makeMetrics();
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, rows, null, lqByKey);
      expect(insights.some(i => i.id === 'i10-roas-inversion')).toBe(true);
    });

    it('does NOT fire when best CPA and best ROAS are same', () => {
      const rows = [
        makeRow('c1', 'Campaign A', { cost_per_result: 10 }),
        makeRow('c2', 'Campaign B', { cost_per_result: 20 }),
      ];
      const lqByKey: Record<string, LeadQualityMetrics> = {
        c1: makeLQ({ campaign_key: 'c1', roas_real: 5.0 }),
        c2: makeLQ({ campaign_key: 'c2', roas_real: 2.0 }),
      };
      const metrics = makeMetrics();
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, rows, null, lqByKey);
      expect(insights.some(i => i.id === 'i10-roas-inversion')).toBe(false);
    });
  });

  describe('I11: Creative Expiry', () => {
    it('fires for creatives at 80%+ lifespan with 25%+ degradation', () => {
      const creative = makeCreative({
        format: 'video', days_active: 13, // 13/14 = 93%
        degradation_pct: 30, status: 'active',
      });
      const metrics = makeMetrics();
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, [], null, undefined, [creative]);
      expect(insights.some(i => i.id.startsWith('i11-creative-expiry'))).toBe(true);
    });

    it('does NOT fire for paused creatives', () => {
      const creative = makeCreative({
        format: 'video', days_active: 13,
        degradation_pct: 30, status: 'paused',
      });
      const metrics = makeMetrics();
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, [], null, undefined, [creative]);
      expect(insights.some(i => i.id.startsWith('i11-creative-expiry'))).toBe(false);
    });
  });

  describe('I12: CPM Auction vs Saturation', () => {
    it('fires when CPM up 15%+, frequency stable, reach growing', () => {
      const curr = makeMetrics({ cpm: 25, frequency: 1.5, reach: 35000 });
      const prev = makeMetrics({ cpm: 20, frequency: 1.5, reach: 30000 });
      const delta = makeDelta(curr, prev);
      const insights = generateInsights(curr, delta, []);
      expect(insights.some(i => i.id === 'i12-cpm-auction')).toBe(true);
    });

    it('does NOT fire when frequency also rising (saturation)', () => {
      const curr = makeMetrics({ cpm: 25, frequency: 3.5, reach: 35000 });
      const prev = makeMetrics({ cpm: 20, frequency: 1.5, reach: 30000 });
      const delta = makeDelta(curr, prev);
      const insights = generateInsights(curr, delta, []);
      expect(insights.some(i => i.id === 'i12-cpm-auction')).toBe(false);
    });
  });

  describe('I13: High CTR Low Booking', () => {
    it('fires when CTR >= 4% and taxa_agendamento < 15%', () => {
      const metrics = makeMetrics({ ctr_link: 5.0 });
      const lq = makeLQ({ taxa_agendamento: 0.10, leads_total: 30 });
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, [], lq);
      expect(insights.some(i => i.id === 'i13-ctr-booking-gap')).toBe(true);
    });

    it('does NOT fire when CTR < 4%', () => {
      const metrics = makeMetrics({ ctr_link: 3.0 });
      const lq = makeLQ({ taxa_agendamento: 0.10, leads_total: 30 });
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, [], lq);
      expect(insights.some(i => i.id === 'i13-ctr-booking-gap')).toBe(false);
    });
  });

  describe('I14: Learning Phase', () => {
    it('fires for rows with < 50 results and > R$150 spend', () => {
      const rows = [makeRow('c1', 'Stuck Campaign', { results: 10, spend_brl: 300 })];
      const metrics = makeMetrics();
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, rows);
      expect(insights.some(i => i.id === 'i14-learning-phase')).toBe(true);
    });

    it('does NOT fire when results >= 50', () => {
      const rows = [makeRow('c1', 'Good Campaign', { results: 60, spend_brl: 300 })];
      const metrics = makeMetrics();
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, rows);
      expect(insights.some(i => i.id === 'i14-learning-phase')).toBe(false);
    });
  });

  describe('I15: Scale Moment', () => {
    it('fires when ROAS >= 3, frequency < 1.5, CPA dropping > 10%', () => {
      const curr = makeMetrics({ frequency: 1.2, cost_per_result: 30 });
      const prev = makeMetrics({ frequency: 1.3, cost_per_result: 40 });
      const delta = makeDelta(curr, prev);
      const lq = makeLQ({ roas_real: 4.0 });
      const insights = generateInsights(curr, delta, [], lq);
      expect(insights.some(i => i.id === 'i15-scale-moment')).toBe(true);
    });

    it('does NOT fire when ROAS < 3', () => {
      const curr = makeMetrics({ frequency: 1.2, cost_per_result: 30 });
      const prev = makeMetrics({ frequency: 1.3, cost_per_result: 40 });
      const delta = makeDelta(curr, prev);
      const lq = makeLQ({ roas_real: 2.0 });
      const insights = generateInsights(curr, delta, [], lq);
      expect(insights.some(i => i.id === 'i15-scale-moment')).toBe(false);
    });
  });

  describe('I16: Best Hook Type', () => {
    it('fires when hook types differ by 15%+ in taxa_atendimento', () => {
      const creatives: CreativeLifecycleRecord[] = [
        makeCreative({ ad_key: 'a1', hook_type: 'before_after' }),
        makeCreative({ ad_key: 'a2', hook_type: 'before_after' }),
        makeCreative({ ad_key: 'a3', hook_type: 'testimonial' }),
        makeCreative({ ad_key: 'a4', hook_type: 'testimonial' }),
      ];
      const lqByKey: Record<string, LeadQualityMetrics> = {
        a1: makeLQ({ leads_total: 15, taxa_atendimento: 0.7 }),
        a2: makeLQ({ leads_total: 15, taxa_atendimento: 0.7 }),
        a3: makeLQ({ leads_total: 15, taxa_atendimento: 0.3 }),
        a4: makeLQ({ leads_total: 15, taxa_atendimento: 0.3 }),
      };
      const metrics = makeMetrics();
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, [], null, lqByKey, creatives);
      expect(insights.some(i => i.id === 'i16-hook-type')).toBe(true);
    });

    it('does NOT fire without hook_type metadata', () => {
      const creatives: CreativeLifecycleRecord[] = [
        makeCreative({ ad_key: 'a1', hook_type: null }),
      ];
      const lqByKey: Record<string, LeadQualityMetrics> = {
        a1: makeLQ({ leads_total: 30, taxa_atendimento: 0.7 }),
      };
      const metrics = makeMetrics();
      const delta = makeDelta(metrics, null);
      const insights = generateInsights(metrics, delta, [], null, lqByKey, creatives);
      expect(insights.some(i => i.id === 'i16-hook-type')).toBe(false);
    });
  });
});
