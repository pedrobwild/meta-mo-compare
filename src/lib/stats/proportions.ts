// ─── Two-proportion z-test & confidence intervals ───
// Used for A/B comparisons of rates (CTR, CVR, LPV rate, close rate, etc).

import { normalCdf, normalInv, zForConfidence, zToPTwoSided } from './distributions';

export interface ProportionTestResult {
  /** Observed rate for variant A (successes / trials). */
  pA: number;
  /** Observed rate for variant B. */
  pB: number;
  /** Absolute lift = pB - pA. */
  absoluteLift: number;
  /** Relative lift = (pB - pA) / pA. Null when pA is 0. */
  relativeLift: number | null;
  /** Pooled standard error used by the z-test. */
  standardError: number;
  /** z-score. */
  z: number;
  /** Two-sided p-value (H0: pA = pB). */
  pValue: number;
  /** True when p < (1 - confidence). */
  significant: boolean;
  /** Confidence interval for absolute lift (two-sided). */
  ciAbsolute: [number, number];
  /** Confidence interval for relative lift, computed with delta method. */
  ciRelative: [number, number] | null;
  confidence: number;
  /** Sample sizes used. */
  nA: number;
  nB: number;
  /** Low-data warning when either arm has <30 trials or <5 successes/failures. */
  lowData: boolean;
}

/**
 * Two-proportion z-test, two-sided.
 * Uses pooled SE for the hypothesis test (standard) and unpooled SE for the CI
 * (more accurate for lift interpretation).
 */
export function twoProportionTest(
  successesA: number,
  trialsA: number,
  successesB: number,
  trialsB: number,
  confidence = 0.95,
): ProportionTestResult {
  const pA = trialsA > 0 ? successesA / trialsA : 0;
  const pB = trialsB > 0 ? successesB / trialsB : 0;
  const nA = trialsA;
  const nB = trialsB;

  const pooled = trialsA + trialsB > 0 ? (successesA + successesB) / (trialsA + trialsB) : 0;
  const sePooled =
    nA > 0 && nB > 0
      ? Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB))
      : 0;
  const seUnpooled =
    nA > 0 && nB > 0
      ? Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB)
      : 0;

  const absoluteLift = pB - pA;
  const z = sePooled > 0 ? absoluteLift / sePooled : 0;
  const pValue = zToPTwoSided(z);
  const zc = zForConfidence(confidence);
  const alpha = 1 - confidence;

  const ciAbsolute: [number, number] = [
    absoluteLift - zc * seUnpooled,
    absoluteLift + zc * seUnpooled,
  ];

  let ciRelative: [number, number] | null = null;
  let relativeLift: number | null = null;
  if (pA > 0) {
    relativeLift = (pB - pA) / pA;
    // Delta-method CI for log(pB/pA): SE ≈ sqrt((1-pA)/(nA pA) + (1-pB)/(nB pB))
    if (pB > 0 && nA > 0 && nB > 0) {
      const logSe = Math.sqrt((1 - pA) / (nA * pA) + (1 - pB) / (nB * pB));
      const logRr = Math.log(pB / pA);
      ciRelative = [Math.exp(logRr - zc * logSe) - 1, Math.exp(logRr + zc * logSe) - 1];
    }
  }

  const lowData =
    nA < 30 ||
    nB < 30 ||
    successesA < 5 ||
    successesB < 5 ||
    nA - successesA < 5 ||
    nB - successesB < 5;

  return {
    pA,
    pB,
    absoluteLift,
    relativeLift,
    standardError: sePooled,
    z,
    pValue,
    significant: pValue < alpha,
    ciAbsolute,
    ciRelative,
    confidence,
    nA,
    nB,
    lowData,
  };
}

/**
 * Wilson score interval for a single proportion.
 * Preferred over normal approximation: stays within [0,1] and handles small n.
 */
export function wilsonInterval(
  successes: number,
  trials: number,
  confidence = 0.95,
): [number, number] {
  if (trials <= 0) return [0, 0];
  const z = zForConfidence(confidence);
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const center = (p + (z * z) / (2 * trials)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials))) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

/**
 * Bayesian "probability variant B is better than A" under Beta-Binomial with a
 * symmetric weak prior (α=β=1 → uniform). Computed via Monte Carlo with a
 * deterministic PRNG for reproducibility.
 */
export function pBeatsA(
  successesA: number,
  trialsA: number,
  successesB: number,
  trialsB: number,
  { samples = 20_000, seed = 42, priorAlpha = 1, priorBeta = 1 } = {},
): number {
  const rand = mulberry32(seed);
  const aA = priorAlpha + successesA;
  const bA = priorBeta + (trialsA - successesA);
  const aB = priorAlpha + successesB;
  const bB = priorBeta + (trialsB - successesB);
  let wins = 0;
  for (let i = 0; i < samples; i++) {
    const sA = betaSample(aA, bA, rand);
    const sB = betaSample(aB, bB, rand);
    if (sB > sA) wins++;
  }
  return wins / samples;
}

/**
 * Sample size per arm required to detect a minimum absolute lift with the
 * given power and alpha (two-sided test). Uses the standard Fleiss-style
 * approximation.
 */
export function sampleSizePerArm(
  baselineRate: number,
  minimumDetectableEffect: number,
  { alpha = 0.05, power = 0.8, relative = false } = {},
): number {
  const p1 = Math.min(Math.max(baselineRate, 1e-6), 1 - 1e-6);
  const lift = relative ? baselineRate * minimumDetectableEffect : minimumDetectableEffect;
  const p2 = Math.min(Math.max(p1 + lift, 1e-6), 1 - 1e-6);
  if (p1 === p2) return Infinity;
  const zAlpha = normalInv(1 - alpha / 2);
  const zBeta = normalInv(power);
  const pBar = (p1 + p2) / 2;
  const n =
    ((zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2) /
    ((p2 - p1) ** 2);
  return Math.ceil(n);
}

// ── Internal helpers ─────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function gammaSample(shape: number, rng: () => number): number {
  // Marsaglia & Tsang (2000) for shape >= 1; boost for shape < 1.
  if (shape < 1) {
    const u = rng();
    return gammaSample(shape + 1, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      const u1 = rng();
      const u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function betaSample(alpha: number, beta: number, rng: () => number): number {
  const x = gammaSample(alpha, rng);
  const y = gammaSample(beta, rng);
  return x / (x + y);
}

// Re-export so consumers don't need to import from distributions directly for the common
// cumulative probability helper (e.g. when computing p-values downstream).
export { normalCdf };
