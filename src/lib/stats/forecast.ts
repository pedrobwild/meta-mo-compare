// ─── Forecasting utilities ───
// Lightweight, explainable forecasts designed for short horizons (1-30 days)
// on noisy marketing time series. No fancy models — just well-chosen simple
// baselines that are honest about their uncertainty.

import { zForConfidence } from './distributions';

export interface LinearFit {
  slope: number;
  intercept: number;
  rSquared: number;
  residualStdDev: number;
  n: number;
}

/** Ordinary least-squares linear regression on (xIndex, y). */
export function linearRegression(values: number[]): LinearFit {
  const n = values.length;
  if (n < 2) {
    return { slope: 0, intercept: values[0] || 0, rSquared: 0, residualStdDev: 0, n };
  }
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXX += i * i;
    sumXY += i * values[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  const denom = sumXX - n * meanX * meanX;
  const slope = denom !== 0 ? (sumXY - n * meanX * meanY) / denom : 0;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - meanY) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const residualStdDev = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  return { slope, intercept, rSquared, residualStdDev, n };
}

export interface ForecastPoint {
  index: number;
  value: number;
  lower: number;
  upper: number;
}

export interface Forecast {
  fit: LinearFit;
  points: ForecastPoint[];
  /** Projected cumulative sum (useful for pacing spend/leads). */
  cumulative: number;
  cumulativeLower: number;
  cumulativeUpper: number;
  confidence: number;
}

/**
 * Forecast the next `horizon` points via linear regression + residual noise.
 * Prediction intervals use a normal approximation (safe for h<=30, n>=7).
 * For pacing projections we also expose the cumulative sum with propagated
 * variance (assuming independent residuals).
 */
export function linearForecast(
  history: number[],
  horizon: number,
  { confidence = 0.9, minPoints = 3 }: { confidence?: number; minPoints?: number } = {},
): Forecast | null {
  if (history.length < minPoints || horizon <= 0) return null;
  const fit = linearRegression(history);
  const z = zForConfidence(confidence);
  const points: ForecastPoint[] = [];
  let cumulative = 0;
  let cumulativeVar = 0;
  for (let h = 0; h < horizon; h++) {
    const idx = history.length + h;
    const val = Math.max(0, fit.intercept + fit.slope * idx);
    const margin = z * fit.residualStdDev;
    points.push({
      index: idx,
      value: val,
      lower: Math.max(0, val - margin),
      upper: val + margin,
    });
    cumulative += val;
    cumulativeVar += fit.residualStdDev * fit.residualStdDev;
  }
  const cumSd = Math.sqrt(cumulativeVar);
  return {
    fit,
    points,
    cumulative,
    cumulativeLower: Math.max(0, cumulative - z * cumSd),
    cumulativeUpper: cumulative + z * cumSd,
    confidence,
  };
}

/**
 * Holt's linear exponential smoothing. Falls back to linear regression's
 * residual std for the prediction interval — good enough for short horizons.
 */
export function holtsForecast(
  history: number[],
  horizon: number,
  {
    alpha = 0.5,
    beta = 0.2,
    confidence = 0.9,
  }: { alpha?: number; beta?: number; confidence?: number } = {},
): Forecast | null {
  if (history.length < 3 || horizon <= 0) return null;
  let level = history[0];
  let trend = history[1] - history[0];
  const residuals: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const prevLevel = level;
    const prevTrend = trend;
    const forecast = prevLevel + prevTrend;
    residuals.push(history[i] - forecast);
    level = alpha * history[i] + (1 - alpha) * (prevLevel + prevTrend);
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
  }
  const fit = linearRegression(history);
  const meanRes = residuals.reduce((s, v) => s + v, 0) / Math.max(1, residuals.length);
  const variance =
    residuals.reduce((s, v) => s + (v - meanRes) ** 2, 0) / Math.max(1, residuals.length - 1);
  const residualStdDev = Math.sqrt(Math.max(variance, fit.residualStdDev ** 2));
  const z = zForConfidence(confidence);

  const points: ForecastPoint[] = [];
  let cumulative = 0;
  let cumulativeVar = 0;
  for (let h = 1; h <= horizon; h++) {
    const val = Math.max(0, level + h * trend);
    const margin = z * residualStdDev * Math.sqrt(h); // drift widens with horizon
    points.push({
      index: history.length + h - 1,
      value: val,
      lower: Math.max(0, val - margin),
      upper: val + margin,
    });
    cumulative += val;
    cumulativeVar += residualStdDev * residualStdDev * h;
  }
  const cumSd = Math.sqrt(cumulativeVar);
  return {
    fit: { ...fit, residualStdDev },
    points,
    cumulative,
    cumulativeLower: Math.max(0, cumulative - z * cumSd),
    cumulativeUpper: cumulative + z * cumSd,
    confidence,
  };
}

/** Simple trailing moving average — useful for smoothed charts. */
export function movingAverage(values: number[], window: number): number[] {
  if (values.length === 0 || window <= 0) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : sum / (i + 1));
  }
  return out;
}
