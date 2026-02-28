import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import {
  aggregateMetrics,
  filterByTruthSourceWithFallback,
  getMonthLabel,
  getAvailableMonths,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/calculations';
import type { AggregatedMetrics } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts';

const CHART_GROUPS = [
  {
    title: 'Investimento & Volume',
    metrics: [
      { key: 'spend_brl', label: 'Investimento', format: formatCurrency },
      { key: 'impressions', label: 'Impressões', format: (v: number) => formatNumber(v) },
      { key: 'link_clicks', label: 'Cliques', format: (v: number) => formatNumber(v) },
      { key: 'results', label: 'Resultados', format: (v: number) => formatNumber(v) },
    ],
    type: 'bar' as const,
  },
  {
    title: 'Eficiência',
    metrics: [
      { key: 'cpc_link', label: 'CPC Link', format: formatCurrency },
      { key: 'cpm', label: 'CPM', format: formatCurrency },
      { key: 'cost_per_result', label: 'Custo/Resultado', format: formatCurrency },
      { key: 'cost_per_lpv', label: 'Custo/LPV', format: formatCurrency },
    ],
    type: 'bar' as const,
  },
  {
    title: 'Taxas',
    metrics: [
      { key: 'ctr_link', label: 'CTR Link (%)', format: (v: number) => formatPercent(v) },
      { key: 'frequency', label: 'Frequência', format: (v: number) => formatNumber(v, 2) },
    ],
    type: 'bar' as const,
  },
];

export default function OverviewCharts() {
  const { state } = useAppState();

  const data = useMemo(() => {
    const months = getAvailableMonths(state.records);
    if (months.length === 0) return [];

    return months
      .slice()
      .reverse()
      .map(m => {
        const recs = filterByTruthSourceWithFallback(state.records, m, state.truthSource);
        const agg = aggregateMetrics(recs);
        return { month: m, label: getMonthLabel(m), ...agg };
      });
  }, [state.records, state.truthSource]);

  if (data.length === 0) return null;

  return (
    <div className="space-y-6">
      {CHART_GROUPS.map(group => (
        <div key={group.title} className="glass-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">{group.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {group.metrics.map(metric => {
              const maxVal = Math.max(...data.map(d => (d as any)[metric.key] || 0));
              if (maxVal === 0) return null;

              return (
                <div key={metric.key}>
                  <p className="text-xs text-muted-foreground mb-2">{metric.label}</p>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          className="fill-muted-foreground"
                          tickFormatter={(v: number) =>
                            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v * 100) / 100)
                          }
                          width={50}
                        />
                        <Tooltip
                          formatter={(value: number) => [metric.format(value), metric.label]}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: 'hsl(var(--foreground))',
                          }}
                        />
                        <Bar
                          dataKey={metric.key}
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={60}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Trend line chart for key metrics when 2+ months */}
      {data.length >= 2 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Tendência MoM</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" width={50} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line
                  type="monotone"
                  dataKey="spend_brl"
                  name="Investimento"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                />
                <Line
                  type="monotone"
                  dataKey="link_clicks"
                  name="Cliques"
                  stroke="hsl(var(--accent-foreground))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(var(--accent-foreground))' }}
                />
                <Line
                  type="monotone"
                  dataKey="results"
                  name="Resultados"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'hsl(var(--destructive))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
