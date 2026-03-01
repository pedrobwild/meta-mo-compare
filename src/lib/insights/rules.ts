import type { AggregatedMetrics, DeltaMetrics } from '../types';
import type { GroupedRow } from '../calculations';
import type { InsightCard } from './types';
import { THRESHOLDS } from './thresholds';
import { computeConfidence } from './score';

// I1: CTR engana — high CTR but low LPV rate
function checkCTRDeception(metrics: AggregatedMetrics, delta: DeltaMetrics): InsightCard | null {
  if (metrics.ctr_link >= 1.0 && metrics.lpv_rate < THRESHOLDS.lpv_rate_low && metrics.link_clicks > 50) {
    return {
      id: 'i1-ctr-deception',
      title: 'CTR alto, mas clique não converte',
      description: `CTR Link de ${metrics.ctr_link.toFixed(2)}% parece bom, mas apenas ${(metrics.lpv_rate * 100).toFixed(0)}% dos cliques chegam à landing page.`,
      evidence: `LPV Rate: ${(metrics.lpv_rate * 100).toFixed(1)}% (abaixo de ${(THRESHOLDS.lpv_rate_low * 100).toFixed(0)}%)`,
      action: 'Verificar se o anúncio está desalinhado com a landing page ou se há cliques acidentais.',
      severity: 'high',
      category: 'post_click',
      confidence: computeConfidence(2, 0.9),
    };
  }
  return null;
}

// I2: Triângulo sagrado — CPM/CTR/CostResult diagnosis
function checkSacredTriangle(metrics: AggregatedMetrics, delta: DeltaMetrics): InsightCard | null {
  if (!delta.previous) return null;

  const cpmChange = delta.deltas['cpm']?.percent;
  const ctrChange = delta.deltas['ctr_link']?.percent;
  const cpaChange = delta.deltas['cost_per_result']?.percent;
  const lpvRateChange = delta.deltas['lpv_rate']?.percent;

  if (cpmChange === null || ctrChange === null) return null;

  // Leilão: CPM↑ & CTR≈ & CPA↑
  if (cpmChange > 10 && Math.abs(ctrChange) < 5 && cpaChange && cpaChange > 10) {
    return {
      id: 'i2-auction-pressure',
      title: 'Pressão de leilão detectada',
      description: `CPM subiu ${cpmChange.toFixed(0)}% enquanto CTR ficou estável. CPA subiu ${cpaChange.toFixed(0)}%.`,
      evidence: `CPM: +${cpmChange.toFixed(1)}%, CTR: ${ctrChange > 0 ? '+' : ''}${ctrChange.toFixed(1)}%`,
      action: 'Diversificar posicionamentos, testar novos públicos ou ajustar lances.',
      severity: 'high',
      category: 'auction',
      confidence: computeConfidence(3, 0.85),
    };
  }

  // Criativo: CTR↓ & CPM≈
  if (ctrChange < -10 && Math.abs(cpmChange) < 10) {
    return {
      id: 'i2-creative-fatigue',
      title: 'Criativo perdendo eficácia',
      description: `CTR caiu ${Math.abs(ctrChange).toFixed(0)}% enquanto CPM se manteve estável.`,
      evidence: `CTR: ${ctrChange.toFixed(1)}%, CPM: ${cpmChange > 0 ? '+' : ''}${cpmChange.toFixed(1)}%`,
      action: 'Renovar criativos e testar novas abordagens de copy.',
      severity: 'medium',
      category: 'creative',
      confidence: computeConfidence(2, 0.8),
    };
  }

  // Pós-clique: CTR≈ & lpv_rate↓ & CPA↑
  if (Math.abs(ctrChange) < 5 && lpvRateChange && lpvRateChange < -10 && cpaChange && cpaChange > 10) {
    return {
      id: 'i2-post-click-issue',
      title: 'Problema pós-clique identificado',
      description: `CTR estável mas LPV Rate caiu ${Math.abs(lpvRateChange).toFixed(0)}% e CPA subiu ${cpaChange.toFixed(0)}%.`,
      evidence: `LPV Rate: ${lpvRateChange.toFixed(1)}%, CPA: +${cpaChange.toFixed(1)}%`,
      action: 'Revisar landing page, velocidade de carregamento e congruência com o anúncio.',
      severity: 'high',
      category: 'post_click',
      confidence: computeConfidence(3, 0.85),
    };
  }

  return null;
}

// I3: Fadiga confirmada
function checkFatigue(metrics: AggregatedMetrics, delta: DeltaMetrics): InsightCard | null {
  if (!delta.previous) return null;

  const freqHigh = metrics.frequency > THRESHOLDS.frequency_high;
  const ctrDrop = delta.deltas['ctr_link']?.percent;
  const cpaDrop = delta.deltas['cost_per_result']?.percent;

  if (freqHigh && ctrDrop && ctrDrop < THRESHOLDS.ctr_drop_pct && cpaDrop && cpaDrop > 10) {
    return {
      id: 'i3-fatigue',
      title: 'Fadiga de audiência confirmada',
      description: `Frequência em ${metrics.frequency.toFixed(1)}, CTR caiu ${Math.abs(ctrDrop).toFixed(0)}% e CPA subiu ${cpaDrop.toFixed(0)}%.`,
      evidence: `Freq: ${metrics.frequency.toFixed(1)}, CTR: ${ctrDrop.toFixed(1)}%, CPA: +${cpaDrop.toFixed(1)}%`,
      action: 'Expandir público-alvo, pausar conjuntos saturados ou renovar criativos.',
      severity: 'high',
      category: 'fatigue',
      confidence: computeConfidence(3, 0.9),
    };
  }

  return null;
}

// I4: CPC barato-lixo
function checkJunkClicks(metrics: AggregatedMetrics): InsightCard | null {
  if (metrics.cpc_link > 0 && metrics.cost_per_lpv > metrics.cpc_link * THRESHOLDS.cost_lpv_multiplier && metrics.link_clicks > 50) {
    return {
      id: 'i4-junk-clicks',
      title: 'CPC barato, mas clique inútil',
      description: `CPC Link é R$${metrics.cpc_link.toFixed(2)}, mas Custo/LPV é R$${metrics.cost_per_lpv.toFixed(2)} (${(metrics.cost_per_lpv / metrics.cpc_link).toFixed(1)}x maior).`,
      evidence: `CPC: R$${metrics.cpc_link.toFixed(2)}, Custo/LPV: R$${metrics.cost_per_lpv.toFixed(2)}`,
      action: 'Muitos cliques não estão qualificados. Revisar segmentação e posicionamento.',
      severity: 'medium',
      category: 'efficiency',
      confidence: computeConfidence(2, 0.85),
    };
  }
  return null;
}

// I5: Gargalo pós-clique
function checkPostClickBottleneck(metrics: AggregatedMetrics, delta: DeltaMetrics): InsightCard | null {
  if (!delta.previous) return null;

  const rpLpvChange = delta.deltas['result_per_lpv']?.percent;
  if (rpLpvChange && rpLpvChange < THRESHOLDS.result_per_lpv_drop_pct && metrics.landing_page_views > 50) {
    return {
      id: 'i5-post-click-bottleneck',
      title: 'Gargalo pós-clique: conversão caiu',
      description: `Result/LPV caiu ${Math.abs(rpLpvChange).toFixed(0)}%. Menos visitantes estão convertendo.`,
      evidence: `Result/LPV: ${rpLpvChange.toFixed(1)}%`,
      action: 'Revisar landing page, formulário e oferta. Testar variações.',
      severity: 'high',
      category: 'post_click',
      confidence: computeConfidence(2, 0.8),
    };
  }
  return null;
}

// I6: Pareto de perda
function checkParetoWaste(rows: GroupedRow[], totalSpend: number, avgCostResult: number): InsightCard[] {
  const insights: InsightCard[] = [];
  const wasteful = rows.filter(r =>
    r.metrics.spend_brl > totalSpend * THRESHOLDS.spend_share_threshold &&
    r.metrics.cost_per_result > avgCostResult * THRESHOLDS.cost_result_above_avg &&
    r.metrics.results > 0
  );

  if (wasteful.length > 0) {
    const names = wasteful.map(r => r.name).slice(0, 3);
    const wastedSpend = wasteful.reduce((acc, r) => acc + r.metrics.spend_brl, 0);

    insights.push({
      id: 'i6-pareto-waste',
      title: `${wasteful.length} item(ns) com CPA acima da média`,
      description: `R$${wastedSpend.toFixed(0)} investidos em itens com CPA ${(THRESHOLDS.cost_result_above_avg * 100 - 100).toFixed(0)}%+ acima da média.`,
      evidence: names.join(', '),
      action: 'Considerar pausar ou otimizar estes itens para realocar budget.',
      severity: 'high',
      category: 'budget',
      confidence: computeConfidence(2, 0.85),
      affectedItems: wasteful.map(r => r.key),
    });
  }

  return insights;
}

// Main: generate all insights
export function generateInsights(
  metrics: AggregatedMetrics,
  delta: DeltaMetrics,
  rows: GroupedRow[]
): InsightCard[] {
  const insights: InsightCard[] = [];

  // Skip if not enough data
  if (metrics.spend_brl < THRESHOLDS.min_spend_for_insight) return insights;

  const i1 = checkCTRDeception(metrics, delta);
  if (i1) insights.push(i1);

  const i2 = checkSacredTriangle(metrics, delta);
  if (i2) insights.push(i2);

  const i3 = checkFatigue(metrics, delta);
  if (i3) insights.push(i3);

  const i4 = checkJunkClicks(metrics);
  if (i4) insights.push(i4);

  const i5 = checkPostClickBottleneck(metrics, delta);
  if (i5) insights.push(i5);

  const avgCostResult = metrics.cost_per_result;
  const i6 = checkParetoWaste(rows, metrics.spend_brl, avgCostResult);
  insights.push(...i6);

  // Sort by severity
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
