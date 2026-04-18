import { describe, it, expect } from 'vitest';
import {
  normalCdf,
  normalInv,
  zForConfidence,
  zToPTwoSided,
  summarize,
  twoProportionTest,
  wilsonInterval,
  sampleSizePerArm,
  pBeatsA,
  detectAnomalies,
  iqrOutliers,
  robustZScores,
  linearRegression,
  linearForecast,
  holtsForecast,
  movingAverage,
  fitElasticity,
  predictResults,
  marginalCostPerResult,
} from '@/lib/stats';

describe('distributions', () => {
  it('normalCdf returns ~0.5 at 0', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
  });

  it('normalCdf tail values are accurate', () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
    expect(normalCdf(2.576)).toBeCloseTo(0.995, 3);
  });

  it('normalInv is the inverse of normalCdf', () => {
    for (const p of [0.025, 0.1, 0.5, 0.9, 0.975]) {
      expect(normalCdf(normalInv(p))).toBeCloseTo(p, 3);
    }
  });

  it('zForConfidence returns known critical values', () => {
    expect(zForConfidence(0.95)).toBeCloseTo(1.96, 2);
    expect(zForConfidence(0.9)).toBeCloseTo(1.645, 2);
    expect(zForConfidence(0.99)).toBeCloseTo(2.576, 2);
  });

  it('two-sided p-value on z=0 is 1', () => {
    expect(zToPTwoSided(0)).toBeCloseTo(1, 3);
  });

  it('summarize handles empty array', () => {
    const s = summarize([]);
    expect(s.n).toBe(0);
    expect(s.mean).toBe(0);
  });

  it('summarize quartiles match hand-computed values', () => {
    const s = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(s.median).toBeCloseTo(5, 5);
    expect(s.q1).toBeCloseTo(3, 5);
    expect(s.q3).toBeCloseTo(7, 5);
    expect(s.iqr).toBeCloseTo(4, 5);
  });
});

describe('proportions', () => {
  it('two-proportion test flags significant differences', () => {
    // 100/1000 vs 150/1000 → clearly significant
    const r = twoProportionTest(100, 1000, 150, 1000);
    expect(r.pA).toBeCloseTo(0.1, 5);
    expect(r.pB).toBeCloseTo(0.15, 5);
    expect(r.pValue).toBeLessThan(0.01);
    expect(r.significant).toBe(true);
    expect(r.ciAbsolute[0]).toBeLessThan(r.absoluteLift);
    expect(r.ciAbsolute[1]).toBeGreaterThan(r.absoluteLift);
  });

  it('two-proportion test returns not significant for tiny effect', () => {
    const r = twoProportionTest(100, 1000, 102, 1000);
    expect(r.significant).toBe(false);
    expect(r.pValue).toBeGreaterThan(0.1);
  });

  it('two-proportion test flags low data warning', () => {
    const r = twoProportionTest(1, 10, 2, 10);
    expect(r.lowData).toBe(true);
  });

  it('relative lift CI is null when pA = 0', () => {
    const r = twoProportionTest(0, 1000, 10, 1000);
    expect(r.relativeLift).toBeNull();
    expect(r.ciRelative).toBeNull();
  });

  it('wilson interval is within [0,1] and contains sample proportion', () => {
    const [lo, hi] = wilsonInterval(50, 100, 0.95);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeLessThan(0.5);
    expect(hi).toBeGreaterThan(0.5);
  });

  it('wilson interval handles extremes', () => {
    const [lo, hi] = wilsonInterval(0, 100, 0.95);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0);
  });

  it('sample size grows when baseline is far from 0.5 and effect is small', () => {
    const small = sampleSizePerArm(0.5, 0.05);
    const tiny = sampleSizePerArm(0.5, 0.01);
    expect(tiny).toBeGreaterThan(small);
  });

  it('Bayesian pBeatsA returns > 0.5 when B is clearly better', () => {
    const prob = pBeatsA(100, 1000, 150, 1000, { samples: 5000, seed: 1 });
    expect(prob).toBeGreaterThan(0.95);
  });

  it('Bayesian pBeatsA is ~0.5 when arms are tied', () => {
    const prob = pBeatsA(100, 1000, 100, 1000, { samples: 5000, seed: 1 });
    expect(prob).toBeGreaterThan(0.4);
    expect(prob).toBeLessThan(0.6);
  });
});

describe('anomalies', () => {
  it('robustZScores returns 0 for constant series', () => {
    const zs = robustZScores([5, 5, 5, 5, 5]);
    expect(zs.every((z) => z === 0)).toBe(true);
  });

  it('detectAnomalies flags clear spikes', () => {
    const values = Array.from({ length: 20 }, () => 10);
    values[15] = 100;
    const result = detectAnomalies(values, { threshold: 3, window: 10 });
    const anomaly = result.points.find((p) => p.index === 15);
    expect(anomaly?.isAnomaly).toBe(true);
    expect(anomaly?.direction).toBe('up');
  });

  it('detectAnomalies returns all non-anomalous for short series', () => {
    const result = detectAnomalies([1, 2, 3]);
    expect(result.points.every((p) => !p.isAnomaly)).toBe(true);
  });

  it('iqrOutliers finds extreme values', () => {
    const idx = iqrOutliers([1, 2, 3, 4, 5, 6, 100]);
    expect(idx).toContain(6);
  });
});

describe('forecast', () => {
  it('linearRegression recovers slope and intercept', () => {
    const values = [1, 3, 5, 7, 9]; // slope 2, intercept 1 (y = 1 + 2x)
    const fit = linearRegression(values);
    expect(fit.slope).toBeCloseTo(2, 5);
    expect(fit.intercept).toBeCloseTo(1, 5);
    expect(fit.rSquared).toBeCloseTo(1, 5);
  });

  it('linearForecast extrapolates and produces a CI', () => {
    const f = linearForecast([10, 12, 14, 16, 18, 20, 22], 3, { confidence: 0.9 });
    expect(f).not.toBeNull();
    expect(f!.points.length).toBe(3);
    // Last point should be increasing
    expect(f!.points[2].value).toBeGreaterThan(f!.points[0].value);
    // CI contains point estimate
    for (const p of f!.points) {
      expect(p.lower).toBeLessThanOrEqual(p.value);
      expect(p.upper).toBeGreaterThanOrEqual(p.value);
    }
  });

  it('linearForecast returns null for tiny series', () => {
    expect(linearForecast([1, 2], 3, { minPoints: 5 })).toBeNull();
  });

  it('holtsForecast tracks a trend', () => {
    const f = holtsForecast([10, 11, 12, 13, 14, 15, 16], 3);
    expect(f).not.toBeNull();
    expect(f!.points[2].value).toBeGreaterThan(f!.points[0].value);
  });

  it('movingAverage smooths', () => {
    const ma = movingAverage([1, 2, 3, 4, 5, 6], 3);
    // ma[2] should be (1+2+3)/3 = 2
    expect(ma[2]).toBeCloseTo(2, 5);
    expect(ma[5]).toBeCloseTo(5, 5);
  });
});

describe('elasticity', () => {
  it('fits near-linear scaling regime', () => {
    // results = 0.05 · spend → β = 1, logA = log(0.05)
    const points = [100, 200, 400, 800, 1600].map((s) => ({
      spend: s,
      results: 0.05 * s,
    }));
    const fit = fitElasticity(points);
    expect(fit.beta).toBeCloseTo(1, 2);
    expect(fit.regime).toBe('scaling');
  });

  it('flags diminishing returns when β small', () => {
    // results = spend^0.3
    const points = [100, 200, 400, 800, 1600].map((s) => ({
      spend: s,
      results: Math.pow(s, 0.3),
    }));
    const fit = fitElasticity(points);
    expect(fit.beta).toBeCloseTo(0.3, 1);
    expect(fit.regime).toBe('diminishing');
  });

  it('predictResults returns 0 for invalid spend', () => {
    const fit = fitElasticity([
      { spend: 100, results: 10 },
      { spend: 200, results: 20 },
      { spend: 400, results: 40 },
    ]);
    expect(predictResults(fit, 0)).toBe(0);
    expect(predictResults(fit, -1)).toBe(0);
  });

  it('marginalCostPerResult is positive for healthy regime', () => {
    const fit = fitElasticity([
      { spend: 100, results: 10 },
      { spend: 200, results: 20 },
      { spend: 400, results: 40 },
    ]);
    expect(marginalCostPerResult(fit, 200)).toBeGreaterThan(0);
  });
});
