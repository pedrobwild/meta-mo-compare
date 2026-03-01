import type { GroupedRow } from '../calculations';

export interface AdComparison {
  id: string;
  adA: { name: string; key: string };
  adB: { name: string; key: string };
  winner: 'A' | 'B' | 'tie';
  title: string;
  description: string;
  recommendation: string;
  metrics: {
    label: string;
    valueA: string;
    valueB: string;
    betterIs: 'A' | 'B' | 'tie';
  }[];
}

export function generateComparisons(rows: GroupedRow[]): AdComparison[] {
  if (rows.length < 2) return [];
  const comparisons: AdComparison[] = [];

  // Only compare rows with enough spend
  const viable = rows.filter(r => r.metrics.spend_brl > 0 && r.metrics.impressions > 100);
  if (viable.length < 2) return [];

  // Compare top pairs
  for (let i = 0; i < Math.min(viable.length, 4); i++) {
    for (let j = i + 1; j < Math.min(viable.length, 4); j++) {
      const a = viable[i];
      const b = viable[j];

      const comp = compareTwo(a, b);
      if (comp) comparisons.push(comp);
    }
  }

  return comparisons.slice(0, 5);
}

function compareTwo(a: GroupedRow, b: GroupedRow): AdComparison | null {
  const ma = a.metrics;
  const mb = b.metrics;

  const metrics: AdComparison['metrics'] = [];
  let aWins = 0;
  let bWins = 0;

  // CPA (lower = better)
  if (ma.cost_per_result > 0 && mb.cost_per_result > 0) {
    const better = ma.cost_per_result < mb.cost_per_result ? 'A' : ma.cost_per_result > mb.cost_per_result ? 'B' : 'tie';
    if (better === 'A') aWins++; else if (better === 'B') bWins++;
    metrics.push({
      label: 'CPA',
      valueA: `R$${ma.cost_per_result.toFixed(2)}`,
      valueB: `R$${mb.cost_per_result.toFixed(2)}`,
      betterIs: better,
    });
  }

  // CTR (higher = better)
  {
    const better = ma.ctr_link > mb.ctr_link ? 'A' : ma.ctr_link < mb.ctr_link ? 'B' : 'tie';
    if (better === 'A') aWins++; else if (better === 'B') bWins++;
    metrics.push({
      label: 'CTR',
      valueA: `${ma.ctr_link.toFixed(2)}%`,
      valueB: `${mb.ctr_link.toFixed(2)}%`,
      betterIs: better,
    });
  }

  // LPV Rate (higher = better)
  if (ma.lpv_rate > 0 || mb.lpv_rate > 0) {
    const better = ma.lpv_rate > mb.lpv_rate ? 'A' : ma.lpv_rate < mb.lpv_rate ? 'B' : 'tie';
    if (better === 'A') aWins++; else if (better === 'B') bWins++;
    metrics.push({
      label: 'LPV Rate',
      valueA: `${(ma.lpv_rate * 100).toFixed(1)}%`,
      valueB: `${(mb.lpv_rate * 100).toFixed(1)}%`,
      betterIs: better,
    });
  }

  // Result/LPV (higher = better)
  if (ma.result_per_lpv > 0 || mb.result_per_lpv > 0) {
    const better = ma.result_per_lpv > mb.result_per_lpv ? 'A' : ma.result_per_lpv < mb.result_per_lpv ? 'B' : 'tie';
    if (better === 'A') aWins++; else if (better === 'B') bWins++;
    metrics.push({
      label: 'Result/LPV',
      valueA: `${(ma.result_per_lpv * 100).toFixed(1)}%`,
      valueB: `${(mb.result_per_lpv * 100).toFixed(1)}%`,
      betterIs: better,
    });
  }

  // Frequency (lower = better / more sustainable)
  if (ma.frequency > 0 && mb.frequency > 0) {
    const better = ma.frequency < mb.frequency ? 'A' : ma.frequency > mb.frequency ? 'B' : 'tie';
    if (better === 'A') aWins++; else if (better === 'B') bWins++;
    metrics.push({
      label: 'Frequência',
      valueA: ma.frequency.toFixed(1),
      valueB: mb.frequency.toFixed(1),
      betterIs: better,
    });
  }

  if (metrics.length < 2) return null;

  const winner = aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'tie';
  const winnerName = winner === 'A' ? a.name : winner === 'B' ? b.name : 'Empate';
  const loserName = winner === 'A' ? b.name : winner === 'B' ? a.name : '';

  // Generate smart recommendation
  let recommendation = '';
  if (winner !== 'tie') {
    const wm = winner === 'A' ? ma : mb;
    const lm = winner === 'A' ? mb : ma;

    // Check if loser has better CTR but worse CPA (hook is good, body/LP is bad)
    const loserBetterCTR = winner === 'A' ? mb.ctr_link > ma.ctr_link : ma.ctr_link > mb.ctr_link;
    const winnerBetterLPV = winner === 'A' ? ma.lpv_rate > mb.lpv_rate : mb.lpv_rate > ma.lpv_rate;

    if (loserBetterCTR && winnerBetterLPV) {
      recommendation = `Testar combinar o gancho de "${loserName}" com o corpo/LP de "${winnerName}"`;
    } else if (wm.frequency < lm.frequency) {
      recommendation = `Escalar "${winnerName}" primeiro — menor frequência = mais vida útil`;
    } else {
      recommendation = `Priorizar budget para "${winnerName}" e considerar pausar ou testar variação de "${loserName}"`;
    }
  } else {
    recommendation = 'Performance similar — manter ambos e monitorar tendência';
  }

  return {
    id: `comp-${a.key}-${b.key}`,
    adA: { name: a.name, key: a.key },
    adB: { name: b.name, key: b.key },
    winner,
    title: winner === 'tie' ? 'Empate técnico' : `${winnerName} vence ${aWins}x${bWins}`,
    description: `Comparação em ${metrics.length} métricas`,
    recommendation,
    metrics,
  };
}
