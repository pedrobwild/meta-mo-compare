// ─── Alert Engine ───
// Evaluates alert rules against aggregated metrics

import type { AggregatedResult } from '../metrics/aggregate';

export interface AlertRule {
  id: string;
  workspace_id: string;
  name: string;
  enabled: boolean;
  severity: 'high' | 'medium' | 'low';
  scope: string;
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'change_gt' | 'change_lt';
  threshold: number;
  window_days: number;
  min_spend: number;
  filters_json: any;
}

export interface AlertEvent {
  id?: string;
  workspace_id: string;
  rule_id: string;
  triggered_at: string;
  context_json: {
    metric: string;
    current_value: number;
    threshold: number;
    entity?: string;
    severity: string;
  };
  status: 'open' | 'ack' | 'resolved';
}

export function evaluateRule(
  rule: AlertRule,
  currentMetrics: AggregatedResult,
  previousMetrics: AggregatedResult | null,
  entityKey?: string
): AlertEvent | null {
  if (!rule.enabled) return null;
  
  // Check minimum spend
  if (rule.min_spend > 0 && (currentMetrics.spend || 0) < rule.min_spend) return null;

  const currentValue = currentMetrics[rule.metric];
  if (currentValue === undefined) return null;

  let triggered = false;

  switch (rule.operator) {
    case 'gt': triggered = currentValue > rule.threshold; break;
    case 'lt': triggered = currentValue < rule.threshold; break;
    case 'gte': triggered = currentValue >= rule.threshold; break;
    case 'lte': triggered = currentValue <= rule.threshold; break;
    case 'change_gt':
    case 'change_lt': {
      if (!previousMetrics) break;
      const prevValue = previousMetrics[rule.metric] || 0;
      const change = prevValue !== 0 ? ((currentValue - prevValue) / Math.abs(prevValue)) * 100 : 0;
      triggered = rule.operator === 'change_gt' ? change > rule.threshold : change < rule.threshold;
      break;
    }
  }

  if (!triggered) return null;

  return {
    workspace_id: rule.workspace_id,
    rule_id: rule.id,
    triggered_at: new Date().toISOString(),
    context_json: {
      metric: rule.metric,
      current_value: currentValue,
      threshold: rule.threshold,
      entity: entityKey,
      severity: rule.severity,
    },
    status: 'open',
  };
}

// ─── Simple Anomaly Detection ───
// Uses z-score against moving average

export interface AnomalyResult {
  metric: string;
  currentValue: number;
  baseline: number;
  stdDev: number;
  zScore: number;
  isAnomaly: boolean;
  direction: 'high' | 'low';
}

export function detectAnomalies(
  dailyValues: number[],
  currentValue: number,
  metric: string,
  zThreshold = 2.0
): AnomalyResult | null {
  if (dailyValues.length < 7) return null;

  const mean = dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length;
  const variance = dailyValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / dailyValues.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return null;

  const zScore = (currentValue - mean) / stdDev;

  return {
    metric,
    currentValue,
    baseline: mean,
    stdDev,
    zScore,
    isAnomaly: Math.abs(zScore) > zThreshold,
    direction: zScore > 0 ? 'high' : 'low',
  };
}

// ─── Heuristic Recommendations ───

export interface Recommendation {
  title: string;
  why: string;
  what_to_do: string;
  priority: number;
  confidence: number;
  entity_level?: string;
  entity_id?: string;
}

export function generateRecommendations(
  current: AggregatedResult,
  previous: AggregatedResult | null
): Recommendation[] {
  const recs: Recommendation[] = [];

  // Creative fatigue: high frequency + declining CTR
  if (current.frequency > 3) {
    const ctrDrop = previous && previous.ctr_link > 0
      ? ((current.ctr_link - previous.ctr_link) / previous.ctr_link) * 100
      : 0;
    if (ctrDrop < -10) {
      recs.push({
        title: 'Fadiga de criativo detectada',
        why: `Frequência de ${current.frequency.toFixed(1)}x com CTR caindo ${Math.abs(ctrDrop).toFixed(0)}%. O público está vendo os mesmos anúncios repetidamente.`,
        what_to_do: 'Rotacione criativos, teste novos formatos (vídeo, carrossel) ou expanda o público-alvo.',
        priority: 90,
        confidence: 0.85,
      });
    }
  }

  // CPM spike
  if (previous && previous.cpm > 0) {
    const cpmChange = ((current.cpm - previous.cpm) / previous.cpm) * 100;
    if (cpmChange > 20) {
      recs.push({
        title: 'CPM em alta significativa',
        why: `CPM subiu ${cpmChange.toFixed(0)}% (${current.cpm.toFixed(2)} → agora). Pode indicar aumento de competição no leilão ou público saturado.`,
        what_to_do: 'Revise a segmentação, teste públicos lookalike mais amplos ou ajuste os lances.',
        priority: 75,
        confidence: 0.7,
      });
    }
  }

  // Low CTR
  if (current.ctr_link < 0.8 && current.impressions > 1000) {
    recs.push({
      title: 'CTR abaixo do benchmark',
      why: `CTR de ${current.ctr_link.toFixed(2)}% está abaixo do benchmark de 0.8%. Os anúncios não estão atraindo cliques.`,
      what_to_do: 'Melhore os criativos: teste headlines mais fortes, CTAs claros e imagens de alto impacto.',
      priority: 70,
      confidence: 0.75,
    });
  }

  // Spend concentration
  if (current.spend > 0 && current.results_leads === 0 && current.impressions > 500) {
    recs.push({
      title: 'Spend sem resultados',
      why: `R$${current.spend.toFixed(0)} investidos sem gerar leads. As campanhas podem estar com problemas de conversão.`,
      what_to_do: 'Verifique a landing page, pixel de conversão e configuração de eventos.',
      priority: 95,
      confidence: 0.9,
    });
  }

  return recs.sort((a, b) => b.priority - a.priority);
}
