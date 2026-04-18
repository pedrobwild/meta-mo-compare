// ─── Spend elasticity / diminishing returns ───
// For senior ad buyers: fit a log-log model (results ~ spend^β) to estimate
// the elasticity β. β near 1 → healthy scaling; β < 0.5 → diminishing returns.

export interface ElasticityFit {
  /** Elasticity coefficient. */
  beta: number;
  /** log(intercept) from the regression. */
  logA: number;
  /** R² of the log-log fit. */
  rSquared: number;
  n: number;
  /**
   * Qualitative read-out for the UI.
   * - scaling: β ≥ 0.8
   * - stable: 0.5 ≤ β < 0.8
   * - diminishing: 0.2 ≤ β < 0.5
   * - saturated: β < 0.2 or negative
   */
  regime: 'scaling' | 'stable' | 'diminishing' | 'saturated' | 'insufficient-data';
}

/**
 * Log-log regression: log(results) = logA + β·log(spend).
 * Skips points where results or spend are 0 (log undefined).
 */
export function fitElasticity(
  points: Array<{ spend: number; results: number }>,
): ElasticityFit {
  const usable = points.filter((p) => p.spend > 0 && p.results > 0);
  const n = usable.length;
  if (n < 3) {
    return {
      beta: 0,
      logA: 0,
      rSquared: 0,
      n,
      regime: 'insufficient-data',
    };
  }
  const xs = usable.map((p) => Math.log(p.spend));
  const ys = usable.map((p) => Math.log(p.results));
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
    sxx += (xs[i] - meanX) ** 2;
  }
  const beta = sxx > 0 ? sxy / sxx : 0;
  const logA = meanY - beta * meanX;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = logA + beta * xs[i];
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  let regime: ElasticityFit['regime'];
  if (beta >= 0.8) regime = 'scaling';
  else if (beta >= 0.5) regime = 'stable';
  else if (beta >= 0.2) regime = 'diminishing';
  else regime = 'saturated';

  return { beta, logA, rSquared, n, regime };
}

/**
 * Given an elasticity fit and a spend level, predict the results value.
 */
export function predictResults(fit: ElasticityFit, spend: number): number {
  if (spend <= 0 || fit.n < 3) return 0;
  return Math.exp(fit.logA + fit.beta * Math.log(spend));
}

/**
 * Marginal CPA at a spend level under the fitted model.
 * Useful to answer: "se eu colocar +R$100, quanto custa o próximo lead?"
 */
export function marginalCostPerResult(fit: ElasticityFit, spend: number): number {
  if (spend <= 0 || fit.n < 3 || fit.beta <= 0) return 0;
  // d(results)/d(spend) = β · A · spend^(β-1)
  const derivative = fit.beta * Math.exp(fit.logA) * Math.pow(spend, fit.beta - 1);
  return derivative > 0 ? 1 / derivative : 0;
}
