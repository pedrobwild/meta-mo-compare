export function computeConfidence(signalCount: number, dataQuality: number): number {
  // signalCount: how many signals confirm this insight (1-3)
  // dataQuality: 0-1 based on data completeness
  const base = Math.min(signalCount / 3, 1);
  return Math.round(base * dataQuality * 100) / 100;
}
