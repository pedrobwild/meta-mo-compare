import { useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  groupByLevel,
  formatCurrency,
  formatNumber,
  formatPercent,
  filterByDateRange,
  getDateRangeLabel,
} from '@/lib/calculations';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, Legend, ReferenceLine,
} from 'recharts';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export default function AdvancedCharts() {
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();

  const data = useMemo(() => {
    if (current.length === 0) return null;
    const avgMetrics = aggregateMetrics(current);
    const rows = groupByLevel(current, previous, state.analysisLevel, '', false);

    // Scatter: CPM vs CPA
    const scatterData = rows
      .filter(r => r.metrics.cpm > 0 && r.metrics.cost_per_result > 0)
      .map((r, i) => ({
        name: r.name,
        cpm: r.metrics.cpm,
        cpa: r.metrics.cost_per_result,
        spend: r.metrics.spend_brl,
        color: COLORS[i % COLORS.length],
      }));

    // Radar per item (normalize to 0-100)
    const radarData = rows.slice(0, 5).map(r => {
      const m = r.metrics;
      const normalize = (val: number, avg: number, inverted: boolean) => {
        if (avg === 0) return 50;
        const ratio = val / avg;
        const score = inverted ? (2 - ratio) * 50 : ratio * 50;
        return Math.max(0, Math.min(100, score));
      };
      return {
        name: r.name,
        efficiency: normalize(m.cost_per_result, avgMetrics.cost_per_result, true),
        quality: normalize(m.lpv_rate, avgMetrics.lpv_rate, false),
        scale: normalize(m.results, avgMetrics.results / (rows.length || 1), false),
        sustainability: normalize(m.frequency, 3, true),
        cost: normalize(m.cpm, avgMetrics.cpm, true),
      };
    });

    // Temporal data: per-date metrics
    const allDates = [...new Set(state.records.map(r => r.period_start))].sort().slice(-8);
    const temporalData = allDates.map(d => {
      const recs = state.records.filter(r => r.period_start === d);
      const agg = aggregateMetrics(recs);
      const dateObj = new Date(d + 'T00:00:00');
      return {
        period: dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        CPA: agg.cost_per_result,
        CTR: agg.ctr_link,
        CPM: agg.cpm,
        'LPV Rate': agg.lpv_rate * 100,
      };
    });

    // Waterfall: CPA decomposition
    let waterfallData: any[] = [];
    if (previous.length > 0) {
      const prevMetrics = aggregateMetrics(previous);
      const prevCPA = prevMetrics.cost_per_result;
      const currCPA = avgMetrics.cost_per_result;

      const factors = [
        { label: 'CPA Anterior', value: prevCPA, type: 'base' as const },
        {
          label: 'Efeito CPM',
          value: prevMetrics.cpm > 0 ? (avgMetrics.cpm - prevMetrics.cpm) / prevMetrics.cpm * prevCPA * 0.4 : 0,
          type: 'change' as const,
        },
        {
          label: 'Efeito CTR',
          value: prevMetrics.ctr_link > 0 ? -(avgMetrics.ctr_link - prevMetrics.ctr_link) / prevMetrics.ctr_link * prevCPA * 0.3 : 0,
          type: 'change' as const,
        },
        {
          label: 'Efeito Conversão',
          value: prevMetrics.result_per_lpv > 0 ? -(avgMetrics.result_per_lpv - prevMetrics.result_per_lpv) / prevMetrics.result_per_lpv * prevCPA * 0.3 : 0,
          type: 'change' as const,
        },
        { label: 'CPA Atual', value: currCPA, type: 'total' as const },
      ];
      waterfallData = factors;
    }

    return { scatterData, radarData, temporalData, waterfallData, avgMetrics };
  }, [current, previous, state.records, state.analysisLevel]);

  if (!data) return null;

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    fontSize: '11px',
    color: 'hsl(var(--foreground))',
  };

  const radarSubjects = [
    { key: 'efficiency', label: 'Eficiência' },
    { key: 'quality', label: 'Qualidade' },
    { key: 'scale', label: 'Escala' },
    { key: 'sustainability', label: 'Sustentab.' },
    { key: 'cost', label: 'Custo' },
  ];

  return (
    <div className="space-y-6">
      {data.scatterData.length > 1 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-1">CPM vs CPA — Mapa de Eficiência</h3>
          <p className="text-xs text-muted-foreground mb-4">Itens no canto inferior-esquerdo são mais eficientes. Tamanho = investimento.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="cpm" name="CPM" tick={{ fontSize: 10 }} className="fill-muted-foreground"
                  label={{ value: 'CPM (R$)', position: 'bottom', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="cpa" name="CPA" tick={{ fontSize: 10 }} className="fill-muted-foreground"
                  label={{ value: 'CPA (R$)', angle: -90, position: 'left', fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => {
                  return [name === 'cpm' ? formatCurrency(value) : name === 'cpa' ? formatCurrency(value) : formatCurrency(value), name === 'cpm' ? 'CPM' : name === 'cpa' ? 'CPA' : 'Invest.'];
                }} />
                <Scatter data={data.scatterData} fill="hsl(var(--primary))">
                  {data.scatterData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} r={Math.max(4, Math.min(16, Math.sqrt(entry.spend) * 0.5))} />
                  ))}
                </Scatter>
                <ReferenceLine x={data.avgMetrics.cpm} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                <ReferenceLine y={data.avgMetrics.cost_per_result} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.radarData.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-1">Perfil de Performance</h3>
          <p className="text-xs text-muted-foreground mb-4">5 eixos normalizados: quanto mais para fora, melhor.</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarSubjects.map(s => ({
                subject: s.label,
                ...Object.fromEntries(data.radarData.map(r => [r.name, (r as any)[s.key]])),
              }))}>
                <PolarGrid className="stroke-border/40" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} className="fill-muted-foreground" />
                {data.radarData.map((item, i) => (
                  <Radar key={item.name} name={item.name} dataKey={item.name}
                    stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.15} strokeWidth={2} />
                ))}
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.waterfallData.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-1">Decomposição da Mudança no CPA</h3>
          <p className="text-xs text-muted-foreground mb-4">Quanto cada fator contribuiu para a mudança do CPA entre períodos.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.waterfallData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={v => `R$${v.toFixed(0)}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCurrency(Math.abs(value)), 'Valor']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {data.waterfallData.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.type === 'base' ? 'hsl(var(--muted-foreground))'
                        : entry.type === 'total' ? 'hsl(var(--primary))'
                        : entry.value > 0 ? 'hsl(var(--negative))' : 'hsl(var(--positive))'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-1">Tendência Temporal</h3>
        <p className="text-xs text-muted-foreground mb-4">Evolução das métricas-chave ao longo do tempo.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['CPA', 'CTR', 'CPM', 'LPV Rate'].map(metric => {
            const maxVal = Math.max(...data.temporalData.map(d => (d as any)[metric] || 0));
            if (maxVal === 0) return null;
            return (
              <div key={metric}>
                <p className="text-xs text-muted-foreground mb-2">{metric}</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.temporalData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="period" tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" width={45}
                        tickFormatter={(v: number) => metric === 'CTR' || metric === 'LPV Rate' ? `${v.toFixed(1)}%` : `R$${v.toFixed(0)}`} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey={metric} fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
