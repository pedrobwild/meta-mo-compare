// ─── Statistical distributions & core helpers ───
// Pure, dependency-free implementations. Accurate enough for product analytics
// (CTR/CVR/CPL significance, sample size, CI). Not suitable for research use.

/**
 * Standard normal CDF Φ(x).
 * Abramowitz & Stegun 26.2.17 — max error ≈ 7.5e-8.
 */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  // A&S 7.1.26
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/** Standard normal PDF φ(x). */
export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Inverse standard normal CDF (quantile function).
 * Beasley-Springer-Moro approximation — max error ≈ 4.5e-4 across the full range.
 * Accurate enough for confidence intervals and z-score lookups.
 */
export function normalInv(p: number): number {
  if (p <= 0 || p >= 1) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    return NaN;
  }
  // Coefficients
  const a = [
    -39.696830, 220.946098, -275.928510, 138.357751, -30.664798, 2.506628,
  ];
  const b = [-54.476098, 161.585836, -155.698979, 66.801311, -13.280681];
  const c = [
    -0.007784894, -0.32239645, -2.400758, -2.549732, 4.374664, 2.938163,
  ];
  const d = [0.007784695, 0.32246712, 2.445134, 3.754408];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

/** Two-sided normal p-value from a z-score. */
export function zToPTwoSided(z: number): number {
  return 2 * (1 - normalCdf(Math.abs(z)));
}

/** One-sided normal p-value (upper tail). */
export function zToPOneSided(z: number): number {
  return 1 - normalCdf(z);
}

/**
 * Z value for a two-sided confidence level (e.g. 0.95 → 1.959964).
 */
export function zForConfidence(confidence: number): number {
  const alpha = 1 - confidence;
  return normalInv(1 - alpha / 2);
}

/** Descriptive stats. */
export interface Summary {
  n: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  sum: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
}

export function summarize(values: number[]): Summary {
  const n = values.length;
  if (n === 0) {
    return { n: 0, mean: 0, stdDev: 0, min: 0, max: 0, sum: 0, median: 0, q1: 0, q3: 0, iqr: 0 };
  }
  let sum = 0;
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / n;
  let variance = 0;
  for (const v of values) variance += (v - mean) * (v - mean);
  // Sample stdev (n-1) when n>1, else 0
  variance = n > 1 ? variance / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const median = pct(0.5);
  const q1 = pct(0.25);
  const q3 = pct(0.75);

  return { n, mean, stdDev, min, max, sum, median, q1, q3, iqr: q3 - q1 };
}
