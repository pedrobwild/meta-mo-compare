export { METRICS, METRIC_KEYS, getMetric, getMetricLabel, formatMetric } from './registry';
export type { MetricDefinition, MetricType, MetricUnit } from './registry';
export { aggregateInsights, computeDeltas } from './aggregate';
export type { InsightRow, AggregatedResult, DeltaResult } from './aggregate';
export { explainChange, paretoAnalysis } from './explain';
export type { Driver, ExplainResult, ParetoItem } from './explain';
