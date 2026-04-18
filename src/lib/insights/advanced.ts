// ─── Advanced insights ───
// Statistical rules that complement rules.ts. These require more data than
// the deterministic rules (enough history for time-series, enough sample for
// proportion tests) and are therefore computed separately.

import type { MetaRecord, AggregatedMetrics } from '../types';
import type { GroupedRow } from '../calculations';
import { detectAnomalies } from '../stats/anomalies';
import { fitElasticity, predictResults, marginalCostPerResult } from '../stats/elasticity';
import { twoProportionTest } from '../stats/proportions';
import { linearForecast } from '../stats/forecast';
import type { InsightCard } from './types';

/**
 * Time-series anomaly check — flag days with extreme spend, CPC, CTR or
 * result volume. Operates at the workspace level on daily totals.
 */
export function anomalyInsights(records: MetaRecord[]): InsightCard[] {
  if (records.length < 10) return [];

  const byDay = new Map<string, { spend: number; impressions: number; link_clicks: number; results: number }>();
  for (const r of records) {
    if (!r.period_start || r.period_start === 'unknown') continue;
    const d = r.period_start;
    if (!byDay.has(d)) byDay.set(d, { spend: 0, impressions: 0, link_clicks: 0, results: 0 });
    const bucket = byDay.get(d)!;
    bucket.spend += r.spend_brl;
    bucket.impressions += r.impressions;
    bucket.link_clicks += r.link_clicks;
    bucket.results += r.results;
  }

  const dates = Array.from(byDay.keys()).sort();
  if (dates.length < 10) return [];

  const spend = dates.map((d) => byDay.get(d)!.spend);
  const results = dates.map((d) => byDay.get(d)!.results);
  const cpc = dates.map((d) => {
    const b = byDay.get(d)!;
    return b.link_clicks > 0 ? b.spend / b.link_clicks : 0;
  });
  const cpa = dates.map((d) => {
    const b = byDay.get(d)!;
    return b.results > 0 ? b.spend / b.results : 0;
  });

  const insights: InsightCard[] = [];
  const lastDate = dates[dates.length - 1];

  const push = (series: { points: { index: number; isAnomaly: boolean; direction: 'up' | 'down'; value: number; severity: string; baseline: number }[] }, label: string, good: 'up' | 'down') => {
    const latest = series.points[series.points.length - 1];
    if (!latest?.isAnomaly) return;
    const isBad = latest.direction !== good;
    const title = `${label} ${latest.direction === 'up' ? 'subiu' : 'caiu'} fora do padrão em ${lastDate}`;
    insights.push({
      id: `anom-${label}-${lastDate}`,
      title,
      description: `Valor: ${latest.value.toFixed(2)} vs baseline recente ${latest.baseline.toFixed(2)} (severidade ${latest.severity}).`,
      evidence: `Série de ${dates.length} dias, MAD-based z-score.`,
      action:
        isBad
          ? 'Investigar causa raiz: mudança de criativo, budget, público ou ajuste externo (evento, concorrência).'
          : 'Replicar causas: se foi mudança sua, documentar. Se foi externo, monitorar se persiste.',
      severity: isBad ? 'high' : 'low',
      category: 'efficiency',
      confidence: 0.85,
    });
  };

  push(detectAnomalies(spend, { threshold: 2.5, window: 14, dates }), 'Spend diário', 'up');
  push(detectAnomalies(results, { threshold: 2.5, window: 14, dates }), 'Resultados diários', 'up');
  push(detectAnomalies(cpc, { threshold: 2.5, window: 14, dates }), 'CPC diário', 'down');
  push(detectAnomalies(cpa, { threshold: 2.5, window: 14, dates }), 'CPA diário', 'down');

  return insights;
}

/**
 * Diminishing returns: fit spend → results elasticity per campaign.
 * Emits an insight when the campaign is clearly in a saturated regime with
 * meaningful spend share.
 */
export function diminishingReturnsInsights(rows: GroupedRow[], totalSpend: number): InsightCard[] {
  const insights: InsightCard[] = [];
  for (const row of rows) {
    // Use per-record daily data inside the period to fit a curve.
    const points = row.records
      .map((r) => ({ spend: r.spend_brl, results: r.results }))
      .filter((p) => p.spend > 0);
    if (points.length < 5) continue;
    const fit = fitElasticity(points);
    if (fit.regime === 'insufficient-data') continue;
    const spendShare = totalSpend > 0 ? row.metrics.spend_brl / totalSpend : 0;
    if (fit.regime === 'saturated' && spendShare > 0.1) {
      const marginal = marginalCostPerResult(fit, row.metrics.spend_brl);
      insights.push({
        id: `elasticity-saturated-${row.key}`,
        title: `"${row.name}" está saturada`,
        description: `Elasticidade de ${fit.beta.toFixed(2)} (β<0.2). Cada real adicional gera cada vez menos resultados. CPA marginal estimado: R$${marginal.toFixed(2)}.`,
        evidence: `${fit.n} pontos, R²=${fit.rSquared.toFixed(2)}, share de spend ${(spendShare * 100).toFixed(0)}%`,
        action: 'Considerar migrar budget para campanhas em regime de escala (β≥0.8). Aumentos agressivos aqui não compensam.',
        severity: 'medium',
        category: 'budget',
        confidence: Math.min(0.9, 0.5 + fit.rSquared / 2),
        affectedItems: [row.key],
      });
    } else if (fit.regime === 'scaling' && spendShare < 0.15 && row.metrics.spend_brl > 200) {
      insights.push({
        id: `elasticity-scaling-${row.key}`,
        title: `"${row.name}" com headroom para escalar`,
        description: `Elasticidade ${fit.beta.toFixed(2)} (β≥0.8) — cada real extra devolve quase proporcionalmente. Share atual apenas ${(spendShare * 100).toFixed(0)}%.`,
        evidence: `${fit.n} pontos, R²=${fit.rSquared.toFixed(2)}`,
        action: 'Aumentar budget em passos de 20% e reavaliar em 3–5 dias. Não pular direto para +100% para não quebrar o aprendizado.',
        severity: 'low',
        category: 'budget',
        confidence: Math.min(0.85, 0.4 + fit.rSquared / 2),
        affectedItems: [row.key],
      });
    }
  }
  return insights;
}

/**
 * Significant movers: between current and previous period, find rows whose
 * CTR, CVR or CPA moved enough that the change is statistically unlikely to
 * be noise. We use a two-proportion test for rate-like metrics.
 */
export function significantMovers(rows: GroupedRow[], limit = 5): InsightCard[] {
  const movers: Array<{ row: GroupedRow; metric: string; pValue: number; lift: number; direction: 'up' | 'down' }> = [];
  for (const row of rows) {
    const prev = row.previousMetrics;
    if (!prev) continue;
    if (row.metrics.impressions < 500 || prev.impressions < 500) continue;
    // CTR test
    const ctrTest = twoProportionTest(
      prev.link_clicks,
      prev.impressions,
      row.metrics.link_clicks,
      row.metrics.impressions,
    );
    if (!ctrTest.lowData && ctrTest.significant) {
      movers.push({
        row,
        metric: 'CTR Link',
        pValue: ctrTest.pValue,
        lift: ctrTest.relativeLift ?? 0,
        direction: ctrTest.absoluteLift > 0 ? 'up' : 'down',
      });
    }
    // CVR LPV test (conversion of link_clicks to LPVs)
    if (row.metrics.link_clicks > 100 && prev.link_clicks > 100) {
      const cvrTest = twoProportionTest(
        prev.landing_page_views,
        prev.link_clicks,
        row.metrics.landing_page_views,
        row.metrics.link_clicks,
      );
      if (!cvrTest.lowData && cvrTest.significant) {
        movers.push({
          row,
          metric: 'LPV Rate',
          pValue: cvrTest.pValue,
          lift: cvrTest.relativeLift ?? 0,
          direction: cvrTest.absoluteLift > 0 ? 'up' : 'down',
        });
      }
    }
  }
  movers.sort((a, b) => a.pValue - b.pValue);
  return movers.slice(0, limit).map((m) => ({
    id: `mover-${m.metric}-${m.row.key}`,
    title: `${m.metric} de "${m.row.name}" ${m.direction === 'up' ? 'subiu' : 'caiu'} com significância estatística`,
    description: `${m.metric} moveu ${(m.lift * 100).toFixed(1)}% entre períodos (p=${m.pValue.toFixed(4)}).`,
    evidence: `Teste de duas proporções — prob. de ser ruído: ${(m.pValue * 100).toFixed(2)}%`,
    action: m.direction === 'up'
      ? 'Mudança positiva significativa: documente o que foi alterado (criativo, público, LP) para replicar.'
      : 'Mudança negativa significativa: investigar. Não é flutuação — algo mudou de fato.',
    severity: m.direction === 'up' ? 'low' : 'high',
    category: 'efficiency',
    confidence: 0.9,
    affectedItems: [m.row.key],
  } satisfies InsightCard));
}

/**
 * Budget pacing projection. If the user has a `spend` target for the period
 * and we have enough history, project end-of-period spend via linear regression
 * and warn when projection over/under-shoots target by more than 10%.
 */
export function pacingInsights(
  records: MetaRecord[],
  dateFrom: string,
  dateTo: string,
  spendTarget: number | undefined,
): InsightCard[] {
  if (!spendTarget || spendTarget <= 0) return [];
  if (!dateFrom || !dateTo) return [];
  const byDay = new Map<string, number>();
  for (const r of records) {
    if (!r.period_start || r.period_start < dateFrom || r.period_start > dateTo) continue;
    byDay.set(r.period_start, (byDay.get(r.period_start) || 0) + r.spend_brl);
  }
  const dates = Array.from(byDay.keys()).sort();
  if (dates.length < 3) return [];
  const series = dates.map((d) => byDay.get(d) || 0);

  // Days remaining until dateTo (exclusive of last day we have data for)
  const lastDate = dates[dates.length - 1];
  const end = new Date(dateTo + 'T00:00:00');
  const last = new Date(lastDate + 'T00:00:00');
  const daysRemaining = Math.max(0, Math.round((end.getTime() - last.getTime()) / 86400000));
  if (daysRemaining === 0) return [];

  const forecast = linearForecast(series, daysRemaining, { confidence: 0.9 });
  if (!forecast) return [];
  const actualSoFar = series.reduce((s, v) => s + v, 0);
  const projectedTotal = actualSoFar + forecast.cumulative;
  const projectedLo = actualSoFar + forecast.cumulativeLower;
  const projectedHi = actualSoFar + forecast.cumulativeUpper;
  const deltaPct = (projectedTotal - spendTarget) / spendTarget;
  if (Math.abs(deltaPct) < 0.1) return [];
  const overshoot = deltaPct > 0;
  return [
    {
      id: `pacing-forecast`,
      title: overshoot ? 'Projeção de estouro de orçamento' : 'Projeção de ficar abaixo da meta de spend',
      description: `Projeção ao final do período: R$${projectedTotal.toFixed(0)} (meta: R$${spendTarget.toFixed(0)}, desvio ${(deltaPct * 100).toFixed(0)}%).`,
      evidence: `IC 90%: R$${projectedLo.toFixed(0)} — R$${projectedHi.toFixed(0)} • baseado em ${series.length} dias`,
      action: overshoot
        ? 'Reduzir budget diário ou pausar campanhas de menor performance para não estourar.'
        : 'Aumentar budget diário ou redistribuir para campanhas com headroom — senão, meta não será atingida.',
      severity: Math.abs(deltaPct) > 0.25 ? 'high' : 'medium',
      category: 'budget',
      confidence: 0.8,
    },
  ];
}

/**
 * Fatigue score — composite of frequency, CTR decay and creative vintage. Surfaces
 * a single ordered list per ad so the user sees the biggest fires first.
 */
export interface FatigueScore {
  key: string;
  name: string;
  score: number;
  reasons: string[];
  metrics: AggregatedMetrics;
}

export function fatigueScores(rows: GroupedRow[]): FatigueScore[] {
  const scores: FatigueScore[] = [];
  for (const row of rows) {
    const m = row.metrics;
    const p = row.previousMetrics;
    let score = 0;
    const reasons: string[] = [];
    if (m.frequency >= 4) {
      score += 30;
      reasons.push(`frequência ${m.frequency.toFixed(1)}`);
    } else if (m.frequency >= 3) {
      score += 15;
      reasons.push(`frequência ${m.frequency.toFixed(1)}`);
    }
    if (p && p.ctr_link > 0) {
      const drop = (m.ctr_link - p.ctr_link) / p.ctr_link;
      if (drop <= -0.2) {
        score += 25;
        reasons.push(`CTR caiu ${(Math.abs(drop) * 100).toFixed(0)}%`);
      } else if (drop <= -0.1) {
        score += 12;
        reasons.push(`CTR caiu ${(Math.abs(drop) * 100).toFixed(0)}%`);
      }
    }
    if (p && p.cost_per_result > 0 && m.cost_per_result > 0) {
      const rise = (m.cost_per_result - p.cost_per_result) / p.cost_per_result;
      if (rise >= 0.2) {
        score += 20;
        reasons.push(`CPA subiu ${(rise * 100).toFixed(0)}%`);
      }
    }
    if (m.spend_brl > 200 && m.results === 0) {
      score += 25;
      reasons.push('spend sem resultados');
    }
    if (score > 0) scores.push({ key: row.key, name: row.name, score, reasons, metrics: m });
  }
  return scores.sort((a, b) => b.score - a.score);
}
