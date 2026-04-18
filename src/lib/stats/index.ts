// ─── Stats public API ───
// Single entry point for the statistical toolkit. Keep imports focused to
// avoid pulling everything into every bundle chunk.

export {
  normalCdf,
  normalPdf,
  normalInv,
  zForConfidence,
  zToPTwoSided,
  zToPOneSided,
  summarize,
  type Summary,
} from './distributions';

export {
  twoProportionTest,
  wilsonInterval,
  pBeatsA,
  sampleSizePerArm,
  type ProportionTestResult,
} from './proportions';

export {
  robustZScores,
  detectAnomalies,
  iqrOutliers,
  type AnomalyPoint,
  type AnomalySeries,
} from './anomalies';

export {
  linearRegression,
  linearForecast,
  holtsForecast,
  movingAverage,
  type LinearFit,
  type Forecast,
  type ForecastPoint,
} from './forecast';

export {
  fitElasticity,
  predictResults,
  marginalCostPerResult,
  type ElasticityFit,
} from './elasticity';
