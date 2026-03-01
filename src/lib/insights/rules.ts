import type { AggregatedMetrics, DeltaMetrics } from '../types';
import type { GroupedRow } from '../calculations';
import type { InsightCard } from './types';
import { THRESHOLDS } from './thresholds';
import { computeConfidence } from './score';

// I1: CTR engana — high CTR but low LPV rate
function checkCTRDeception(metrics: AggregatedMetrics): InsightCard | null {
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
  const cpmC = delta.deltas['cpm']?.percent;
  const ctrC = delta.deltas['ctr_link']?.percent;
  const cpaC = delta.deltas['cost_per_result']?.percent;
  const lpvC = delta.deltas['lpv_rate']?.percent;
  if (cpmC === null || ctrC === null) return null;

  if (cpmC > 10 && Math.abs(ctrC) < 5 && cpaC && cpaC > 10) {
    return {
      id: 'i2-auction', title: 'Pressão de leilão detectada',
      description: `CPM subiu ${cpmC.toFixed(0)}% enquanto CTR ficou estável. CPA subiu ${cpaC.toFixed(0)}%.`,
      evidence: `CPM: +${cpmC.toFixed(1)}%, CTR: ${ctrC > 0 ? '+' : ''}${ctrC.toFixed(1)}%`,
      action: 'Diversificar posicionamentos, testar novos públicos ou ajustar lances.',
      severity: 'high', category: 'auction', confidence: computeConfidence(3, 0.85),
    };
  }
  if (ctrC < -10 && Math.abs(cpmC) < 10) {
    return {
      id: 'i2-creative', title: 'Criativo perdendo eficácia',
      description: `CTR caiu ${Math.abs(ctrC).toFixed(0)}% enquanto CPM se manteve estável.`,
      evidence: `CTR: ${ctrC.toFixed(1)}%, CPM: ${cpmC > 0 ? '+' : ''}${cpmC.toFixed(1)}%`,
      action: 'Renovar criativos e testar novas abordagens de copy.',
      severity: 'medium', category: 'creative', confidence: computeConfidence(2, 0.8),
    };
  }
  if (Math.abs(ctrC) < 5 && lpvC && lpvC < -10 && cpaC && cpaC > 10) {
    return {
      id: 'i2-postclick', title: 'Problema pós-clique identificado',
      description: `CTR estável mas LPV Rate caiu ${Math.abs(lpvC).toFixed(0)}% e CPA subiu ${cpaC.toFixed(0)}%.`,
      evidence: `LPV Rate: ${lpvC.toFixed(1)}%, CPA: +${cpaC.toFixed(1)}%`,
      action: 'Revisar landing page, velocidade de carregamento e congruência com o anúncio.',
      severity: 'high', category: 'post_click', confidence: computeConfidence(3, 0.85),
    };
  }
  // Sweet spot: CPM↓ + CTR↑ + CPA↓
  if (cpmC < -5 && ctrC > 5 && cpaC && cpaC < -5) {
    return {
      id: 'i2-sweetspot', title: 'Sweet Spot — Momento ideal para escalar',
      description: `CPM caiu ${Math.abs(cpmC).toFixed(0)}%, CTR subiu ${ctrC.toFixed(0)}% e CPA caiu ${Math.abs(cpaC).toFixed(0)}%.`,
      evidence: `CPM: ${cpmC.toFixed(1)}%, CTR: +${ctrC.toFixed(1)}%, CPA: ${cpaC.toFixed(1)}%`,
      action: 'Momento ideal para aumentar budget. Aproveitar eficiência de leilão.',
      severity: 'low', category: 'budget', confidence: computeConfidence(3, 0.9),
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
      id: 'i3-fatigue', title: 'Fadiga de audiência confirmada',
      description: `Frequência em ${metrics.frequency.toFixed(1)}, CTR caiu ${Math.abs(ctrDrop).toFixed(0)}% e CPA subiu ${cpaDrop.toFixed(0)}%.`,
      evidence: `Freq: ${metrics.frequency.toFixed(1)}, CTR: ${ctrDrop.toFixed(1)}%, CPA: +${cpaDrop.toFixed(1)}%`,
      action: 'Expandir público-alvo, pausar conjuntos saturados ou renovar criativos.',
      severity: 'high', category: 'fatigue', confidence: computeConfidence(3, 0.9),
    };
  }
  return null;
}

// I4: CPC barato-lixo
function checkJunkClicks(metrics: AggregatedMetrics): InsightCard | null {
  if (metrics.cpc_link > 0 && metrics.cost_per_lpv > metrics.cpc_link * THRESHOLDS.cost_lpv_multiplier && metrics.link_clicks > 50) {
    return {
      id: 'i4-junk', title: 'CPC barato, mas clique inútil',
      description: `CPC Link é R$${metrics.cpc_link.toFixed(2)}, mas Custo/LPV é R$${metrics.cost_per_lpv.toFixed(2)} (${(metrics.cost_per_lpv / metrics.cpc_link).toFixed(1)}x maior).`,
      evidence: `CPC: R$${metrics.cpc_link.toFixed(2)}, Custo/LPV: R$${metrics.cost_per_lpv.toFixed(2)}`,
      action: 'Muitos cliques não são qualificados. Revisar segmentação e posicionamento.',
      severity: 'medium', category: 'efficiency', confidence: computeConfidence(2, 0.85),
    };
  }
  return null;
}

// I5: Gargalo pós-clique
function checkPostClickBottleneck(metrics: AggregatedMetrics, delta: DeltaMetrics): InsightCard | null {
  if (!delta.previous) return null;
  const rpLpvC = delta.deltas['result_per_lpv']?.percent;
  if (rpLpvC && rpLpvC < THRESHOLDS.result_per_lpv_drop_pct && metrics.landing_page_views > 50) {
    return {
      id: 'i5-bottleneck', title: 'Gargalo pós-clique: conversão caiu',
      description: `Result/LPV caiu ${Math.abs(rpLpvC).toFixed(0)}%. Menos visitantes estão convertendo.`,
      evidence: `Result/LPV: ${rpLpvC.toFixed(1)}%`,
      action: 'Revisar landing page, formulário e oferta. Testar variações.',
      severity: 'high', category: 'post_click', confidence: computeConfidence(2, 0.8),
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
      id: 'i6-pareto', title: `${wasteful.length} item(ns) com CPA acima da média`,
      description: `R$${wastedSpend.toFixed(0)} investidos em itens com CPA ${(THRESHOLDS.cost_result_above_avg * 100 - 100).toFixed(0)}%+ acima da média.`,
      evidence: names.join(', '),
      action: 'Considerar pausar ou otimizar estes itens para realocar budget.',
      severity: 'high', category: 'budget', confidence: computeConfidence(2, 0.85),
      affectedItems: wasteful.map(r => r.key),
    });
  }
  return insights;
}

// I7: NEW — Row-level comparative insights
function checkComparativeInsights(rows: GroupedRow[], avgMetrics: AggregatedMetrics): InsightCard[] {
  const insights: InsightCard[] = [];
  if (rows.length < 2) return insights;

  // Find items with misleading CTR (high CTR but worse CPA)
  const viable = rows.filter(r => r.metrics.spend_brl > 0 && r.metrics.results > 0);
  if (viable.length >= 2) {
    // Sort by CTR desc
    const byCTR = [...viable].sort((a, b) => b.metrics.ctr_link - a.metrics.ctr_link);
    const byCPA = [...viable].sort((a, b) => a.metrics.cost_per_result - b.metrics.cost_per_result);

    // If the best CTR item isn't the best CPA item
    if (byCTR[0].key !== byCPA[0].key && byCTR[0].metrics.ctr_link > byCPA[0].metrics.ctr_link * 1.2) {
      insights.push({
        id: 'i7-misleading-ctr',
        title: 'CTR enganoso entre itens',
        description: `"${byCTR[0].name}" tem CTR maior (${byCTR[0].metrics.ctr_link.toFixed(2)}%) mas CPA pior (R$${byCTR[0].metrics.cost_per_result.toFixed(2)}) que "${byCPA[0].name}" (CTR ${byCPA[0].metrics.ctr_link.toFixed(2)}%, CPA R$${byCPA[0].metrics.cost_per_result.toFixed(2)}).`,
        evidence: `LPV Rate: ${(byCTR[0].metrics.lpv_rate * 100).toFixed(0)}% vs ${(byCPA[0].metrics.lpv_rate * 100).toFixed(0)}%`,
        action: `Manter o gancho de "${byCTR[0].name}" mas testar com o corpo/LP de "${byCPA[0].name}"`,
        severity: 'medium', category: 'creative', confidence: computeConfidence(2, 0.75),
        affectedItems: [byCTR[0].key, byCPA[0].key],
      });
    }

    // Find items with similar CPA but different frequency (sustainability)
    for (let i = 0; i < Math.min(viable.length, 3); i++) {
      for (let j = i + 1; j < Math.min(viable.length, 3); j++) {
        const a = viable[i], b = viable[j];
        const cpaDiff = Math.abs(a.metrics.cost_per_result - b.metrics.cost_per_result) / Math.max(a.metrics.cost_per_result, b.metrics.cost_per_result);
        if (cpaDiff < 0.15 && Math.abs(a.metrics.frequency - b.metrics.frequency) > 1) {
          const lowerFreq = a.metrics.frequency < b.metrics.frequency ? a : b;
          const higherFreq = a.metrics.frequency < b.metrics.frequency ? b : a;
          insights.push({
            id: `i7-freq-${a.key}-${b.key}`,
            title: 'CPA similar, sustentabilidade diferente',
            description: `"${lowerFreq.name}" e "${higherFreq.name}" têm CPA similar, mas frequências de ${lowerFreq.metrics.frequency.toFixed(1)} vs ${higherFreq.metrics.frequency.toFixed(1)}.`,
            evidence: `Freq: ${lowerFreq.metrics.frequency.toFixed(1)} vs ${higherFreq.metrics.frequency.toFixed(1)}`,
            action: `Escalar "${lowerFreq.name}" primeiro — menor frequência = mais vida útil.`,
            severity: 'low', category: 'efficiency', confidence: computeConfidence(2, 0.7),
            affectedItems: [lowerFreq.key],
          });
          break;
        }
      }
    }
  }

  return insights;
}

// Main
export function generateInsights(
  metrics: AggregatedMetrics,
  delta: DeltaMetrics,
  rows: GroupedRow[]
): InsightCard[] {
  const insights: InsightCard[] = [];
  if (metrics.spend_brl < THRESHOLDS.min_spend_for_insight) return insights;

  const i1 = checkCTRDeception(metrics);
  if (i1) insights.push(i1);
  const i2 = checkSacredTriangle(metrics, delta);
  if (i2) insights.push(i2);
  const i3 = checkFatigue(metrics, delta);
  if (i3) insights.push(i3);
  const i4 = checkJunkClicks(metrics);
  if (i4) insights.push(i4);
  const i5 = checkPostClickBottleneck(metrics, delta);
  if (i5) insights.push(i5);
  insights.push(...checkParetoWaste(rows, metrics.spend_brl, metrics.cost_per_result));
  insights.push(...checkComparativeInsights(rows, metrics));

  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
