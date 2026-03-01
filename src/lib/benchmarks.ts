// Benchmarks por vertical — valores de referência do mercado
export interface VerticalBenchmarks {
  label: string;
  ctr_link: number;       // %
  cpm: number;            // R$
  cpc_link: number;       // R$
  cost_per_result: number; // R$
  lpv_rate: number;       // 0-1
  frequency_max: number;
}

export const VERTICALS: Record<string, VerticalBenchmarks> = {
  reformas: {
    label: 'Reformas',
    ctr_link: 1.0,
    cpm: 22,
    cpc_link: 2.20,
    cost_per_result: 25,
    lpv_rate: 0.65,
    frequency_max: 3.5,
  },
  ecommerce: {
    label: 'E-commerce',
    ctr_link: 1.5,
    cpm: 25,
    cpc_link: 1.80,
    cost_per_result: 18,
    lpv_rate: 0.70,
    frequency_max: 3.0,
  },
  saas: {
    label: 'SaaS/Leads',
    ctr_link: 0.8,
    cpm: 35,
    cpc_link: 4.50,
    cost_per_result: 45,
    lpv_rate: 0.60,
    frequency_max: 2.5,
  },
  infoprodutos: {
    label: 'Infoprodutos',
    ctr_link: 1.2,
    cpm: 20,
    cpc_link: 1.60,
    cost_per_result: 15,
    lpv_rate: 0.55,
    frequency_max: 4.0,
  },
};

export const DEFAULT_VERTICAL = 'reformas';

export function getBenchmarkStatus(
  metricKey: string,
  value: number,
  benchmarks: VerticalBenchmarks
): 'good' | 'warning' | 'bad' | null {
  const inverted = ['cpm', 'cpc_link', 'cost_per_result'].includes(metricKey);

  const benchmarkMap: Record<string, number> = {
    ctr_link: benchmarks.ctr_link,
    cpm: benchmarks.cpm,
    cpc_link: benchmarks.cpc_link,
    cost_per_result: benchmarks.cost_per_result,
    lpv_rate: benchmarks.lpv_rate,
    frequency: benchmarks.frequency_max,
  };

  const benchmark = benchmarkMap[metricKey];
  if (benchmark === undefined) return null;

  const ratio = value / benchmark;

  if (metricKey === 'frequency') {
    return value <= benchmark * 0.8 ? 'good' : value <= benchmark ? 'warning' : 'bad';
  }

  if (inverted) {
    return ratio <= 0.8 ? 'good' : ratio <= 1.2 ? 'warning' : 'bad';
  }
  return ratio >= 1.2 ? 'good' : ratio >= 0.8 ? 'warning' : 'bad';
}

export function getTooltipText(
  metricKey: string,
  value: number,
  benchmarks: VerticalBenchmarks
): string | null {
  const status = getBenchmarkStatus(metricKey, value, benchmarks);
  if (!status) return null;

  const labels: Record<string, string> = {
    ctr_link: 'CTR Link',
    cpm: 'CPM',
    cpc_link: 'CPC Link',
    cost_per_result: 'CPA',
    lpv_rate: 'LPV Rate',
    frequency: 'Frequência',
  };

  const benchmarkMap: Record<string, number> = {
    ctr_link: benchmarks.ctr_link,
    cpm: benchmarks.cpm,
    cpc_link: benchmarks.cpc_link,
    cost_per_result: benchmarks.cost_per_result,
    lpv_rate: benchmarks.lpv_rate,
    frequency: benchmarks.frequency_max,
  };

  const bv = benchmarkMap[metricKey];
  const label = labels[metricKey] || metricKey;
  const statusText = status === 'good' ? '✅ Bom' : status === 'warning' ? '⚠️ Atenção' : '🔴 Crítico';
  
  return `${statusText} — Benchmark ${benchmarks.label}: ${typeof bv === 'number' && bv < 1 ? (bv * 100).toFixed(0) + '%' : bv?.toFixed(2)}`;
}
