import type { AggregatedMetrics, DeltaMetrics } from '../types';
import type { GroupedRow } from '../calculations';

export type Verdict = 'scale' | 'keep' | 'test_variation' | 'watch' | 'pause';

export interface VerdictResult {
  verdict: Verdict;
  score: number; // 0-100
  label: string;
  emoji: string;
  color: string; // tailwind class
  reasons: string[];
}

const VERDICT_MAP: Record<Verdict, { label: string; emoji: string; color: string }> = {
  scale: { label: 'Escalar', emoji: '🟢', color: 'text-positive' },
  keep: { label: 'Manter', emoji: '🔵', color: 'text-primary' },
  test_variation: { label: 'Testar variação', emoji: '🟡', color: 'text-warning' },
  watch: { label: 'Observar', emoji: '🟠', color: 'text-warning' },
  pause: { label: 'Pausar', emoji: '🔴', color: 'text-negative' },
};

export function computeVerdict(
  row: GroupedRow,
  avgMetrics: AggregatedMetrics
): VerdictResult {
  const m = row.metrics;
  const d = row.delta;
  const reasons: string[] = [];
  let score = 50; // Start neutral

  // === EFFICIENCY (40% weight) ===
  // CPA vs average
  if (avgMetrics.cost_per_result > 0 && m.cost_per_result > 0) {
    const cpaRatio = m.cost_per_result / avgMetrics.cost_per_result;
    if (cpaRatio < 0.7) { score += 15; reasons.push('CPA 30%+ abaixo da média'); }
    else if (cpaRatio < 0.9) { score += 8; reasons.push('CPA abaixo da média'); }
    else if (cpaRatio > 1.5) { score -= 20; reasons.push('CPA 50%+ acima da média'); }
    else if (cpaRatio > 1.2) { score -= 10; reasons.push('CPA acima da média'); }
  }

  // Results volume
  if (m.results > 0 && avgMetrics.results > 0) {
    const volRatio = m.results / (avgMetrics.results || 1);
    if (volRatio > 1.5) { score += 5; reasons.push('Alto volume de resultados'); }
  }

  // === QUALITY (30% weight) ===
  // LPV Rate
  if (m.lpv_rate > 0) {
    if (m.lpv_rate >= 0.8) { score += 10; reasons.push('LPV Rate excelente'); }
    else if (m.lpv_rate >= 0.6) { score += 5; }
    else if (m.lpv_rate < 0.4) { score -= 10; reasons.push('LPV Rate muito baixo'); }
    else if (m.lpv_rate < 0.5) { score -= 5; reasons.push('LPV Rate baixo'); }
  }

  // Result per LPV
  if (m.result_per_lpv > 0) {
    const avgRpLpv = avgMetrics.result_per_lpv || 0;
    if (avgRpLpv > 0) {
      if (m.result_per_lpv > avgRpLpv * 1.3) { score += 10; reasons.push('Conversão pós-clique acima da média'); }
      else if (m.result_per_lpv < avgRpLpv * 0.5) { score -= 10; reasons.push('Conversão pós-clique muito baixa'); }
    }
  }

  // === SUSTAINABILITY (30% weight) ===
  // Frequency
  if (m.frequency > 4) { score -= 15; reasons.push(`Frequência alta (${m.frequency.toFixed(1)})`); }
  else if (m.frequency > 3) { score -= 8; reasons.push(`Frequência moderada (${m.frequency.toFixed(1)})`); }
  else if (m.frequency < 2) { score += 5; }

  // CTR trend
  const ctrDelta = d.deltas['ctr_link']?.percent;
  if (ctrDelta !== undefined && ctrDelta !== null) {
    if (ctrDelta < -20) { score -= 12; reasons.push(`CTR caindo ${Math.abs(ctrDelta).toFixed(0)}%`); }
    else if (ctrDelta < -10) { score -= 6; reasons.push('CTR em queda'); }
    else if (ctrDelta > 15) { score += 8; reasons.push('CTR subindo'); }
  }

  // CPA trend
  const cpaDelta = d.deltas['cost_per_result']?.percent;
  if (cpaDelta !== undefined && cpaDelta !== null) {
    if (cpaDelta > 30) { score -= 10; reasons.push('CPA subindo rápido'); }
    else if (cpaDelta < -15) { score += 8; reasons.push('CPA melhorando'); }
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Determine verdict
  let verdict: Verdict;
  if (score >= 80) verdict = 'scale';
  else if (score >= 60) verdict = 'keep';
  else if (score >= 40) verdict = 'test_variation';
  else if (score >= 20) verdict = 'watch';
  else verdict = 'pause';

  const meta = VERDICT_MAP[verdict];
  return { verdict, score, label: meta.label, emoji: meta.emoji, color: meta.color, reasons };
}

// Heatmap cell color based on value relative to average
export function getHeatmapColor(value: number, avg: number, inverted: boolean): string {
  if (avg === 0) return '';
  const ratio = value / avg;
  const isGood = inverted ? ratio < 1 : ratio > 1;
  const intensity = Math.abs(ratio - 1);

  if (intensity < 0.05) return ''; // neutral
  if (intensity < 0.15) return isGood ? 'bg-positive/10' : 'bg-negative/10';
  if (intensity < 0.30) return isGood ? 'bg-positive/20' : 'bg-negative/20';
  return isGood ? 'bg-positive/30' : 'bg-negative/30';
}
