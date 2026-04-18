// ─── Time series anomaly detection ───
// Robust z-score (MAD-based) + IQR outlier detection. Fits our noisy,
// small-sample daily ads data better than classical z-score because it ignores
// point outliers when estimating the baseline.

export interface AnomalyPoint {
  index: number;
  date?: string;
  value: number;
  baseline: number;
  zScore: number;
  isAnomaly: boolean;
  direction: 'up' | 'down';
  severity: 'low' | 'medium' | 'high';
}

export interface AnomalySeries {
  points: AnomalyPoint[];
  baseline: number;
  dispersion: number;
  method: 'robust-z' | 'iqr';
}

/**
 * Robust z-score via median + MAD (median absolute deviation).
 * Constant 1.4826 makes MAD a consistent estimator of σ under normality.
 */
export function robustZScores(values: number[]): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const median = percentile(sorted, 0.5);
  const deviations = values.map((v) => Math.abs(v - median));
  const mad = percentile([...deviations].sort((a, b) => a - b), 0.5);
  const sigma = 1.4826 * mad || 1e-9;
  return values.map((v) => (v - median) / sigma);
}

/**
 * Detect anomalies on a daily series. Uses a rolling window so that
 * "normal" shifts in spend over a month don't flag everything as anomalous.
 */
export function detectAnomalies(
  values: number[],
  {
    threshold = 3,
    window = 14,
    dates,
  }: { threshold?: number; window?: number; dates?: string[] } = {},
): AnomalySeries {
  const n = values.length;
  if (n === 0) {
    return { points: [], baseline: 0, dispersion: 0, method: 'robust-z' };
  }

  const points: AnomalyPoint[] = [];
  let overallBaseline = 0;
  let overallDispersion = 0;

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - window);
    const slice = values.slice(start, i);
    if (slice.length < 5) {
      // Not enough history to judge — include but flag as not anomalous
      points.push({
        index: i,
        date: dates?.[i],
        value: values[i],
        baseline: values[i],
        zScore: 0,
        isAnomaly: false,
        direction: 'up',
        severity: 'low',
      });
      continue;
    }
    const sorted = [...slice].sort((a, b) => a - b);
    const median = percentile(sorted, 0.5);
    const deviations = slice.map((v) => Math.abs(v - median));
    const mad = percentile([...deviations].sort((a, b) => a - b), 0.5);
    const sigma = 1.4826 * mad || 1e-9;
    const z = (values[i] - median) / sigma;
    const absZ = Math.abs(z);
    const isAnomaly = absZ > threshold;
    const severity: AnomalyPoint['severity'] =
      absZ > threshold * 2 ? 'high' : absZ > threshold * 1.3 ? 'medium' : 'low';
    points.push({
      index: i,
      date: dates?.[i],
      value: values[i],
      baseline: median,
      zScore: z,
      isAnomaly,
      direction: z >= 0 ? 'up' : 'down',
      severity,
    });
    overallBaseline = median;
    overallDispersion = sigma;
  }

  return {
    points,
    baseline: overallBaseline,
    dispersion: overallDispersion,
    method: 'robust-z',
  };
}

/** Simple IQR-based outlier detection on the full series (no windowing). */
export function iqrOutliers(values: number[], multiplier = 1.5): number[] {
  if (values.length < 4) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - multiplier * iqr;
  const hi = q3 + multiplier * iqr;
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] < lo || values[i] > hi) out.push(i);
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
