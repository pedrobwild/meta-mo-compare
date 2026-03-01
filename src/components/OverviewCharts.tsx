import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import { useCrossFilter } from '@/lib/crossFilter';
import {
  aggregateMetrics,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/calculations';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, LineChart, Line,
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
  },
  {
    title: 'Eficiência',
    metrics: [
      { key: 'cpc_link', label: 'CPC Link', format: formatCurrency },
      { key: 'cpm', label: 'CPM', format: formatCurrency },
      { key: 'cost_per_result', label: 'Custo/Resultado', format: formatCurrency },
      { key: 'cost_per_lpv', label: 'Custo/LPV', format: formatCurrency },
    ],
  },
  {
    title: 'Taxas & Derivados',
    metrics: [
      { key: 'ctr_link', label: 'CTR Link (%)', format: (v: number) => formatPercent(v) },
      { key: 'frequency', label: 'Frequência', format: (v: number) => formatNumber(v, 2) },
      { key: 'lpv_rate', label: 'LPV Rate', format: (v: number) => formatPercent(v * 100) },
      { key: 'qualified_ctr', label: 'Qualified CTR', format: (v: number) => formatPercent(v) },
    ],
  },
];

export default function OverviewCharts() {
  const { state } = useAppState();
  const { filter: crossFilter } = useCrossFilter();

  const filteredRecords = useMemo(() => {
    if (!crossFilter.key || !crossFilter.level) return state.records;
    return state.records.filter(r => {
      if (crossFilter.level === 'campaign') return (r.campaign_key || 'sem-campanha') === crossFilter.key;
      if (crossFilter.level === 'adset') return (r.adset_key || 'sem-conjunto') === crossFilter.key;
      if (crossFilter.level === 'ad') return r.ad_key === crossFilter.key;
      return true;
    });
  }, [state.records, crossFilter]);

  const data = useMemo(() => {
    const allDates = [...new Set(filteredRecords.map(r => r.period_start))].sort();
    if (allDates.length === 0) return [];

    return allDates.slice(-8).map(d => {
      const recs = filteredRecords.filter(r => r.period_start === d);
      const agg = aggregateMetrics(recs);
      const dateObj = new Date(d + 'T00:00:00');
      return {
        period: d,
        label: dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        ...agg,
      };
    });
  }, [filteredRecords]);

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
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          className="fill-muted-foreground"
                          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v * 100) / 100)}
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
                        <Bar dataKey={metric.key} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {data.length >= 2 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-4">Tendência Diária</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
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
                <Line type="monotone" dataKey="spend_brl" name="Investimento" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--primary))' }} />
                <Line type="monotone" dataKey="link_clicks" name="Cliques" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--accent-foreground))' }} />
                <Line type="monotone" dataKey="results" name="Resultados" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 4, fill: 'hsl(var(--destructive))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
