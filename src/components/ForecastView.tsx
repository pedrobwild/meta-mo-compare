// ─── Forecast View ───
// Interactive forecast for daily metrics with confidence bands. User picks
// the metric, horizon and method (linear OLS vs Holt's damped trend). Shows
// fan chart, point projection, cumulative projection and comparison against
// target when available.

import { useMemo, useState } from 'react';
import { TrendingUp, Info } from 'lucide-react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine,
} from 'recharts';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { linearForecast, holtsForecast, movingAverage } from '@/lib/stats/forecast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

type MetricKey = 'spend' | 'results' | 'impressions' | 'link_clicks' | 'landing_page_views';
type Method = 'linear' | 'holt';

const METRIC_LABELS: Record<MetricKey, { label: string; format: (v: number) => string }> = {
  spend: { label: 'Spend diário (R$)', format: (v) => `R$ ${v.toFixed(0)}` },
  results: { label: 'Resultados diários', format: (v) => v.toFixed(0) },
  impressions: { label: 'Impressões diárias', format: (v) => v.toLocaleString('pt-BR') },
  link_clicks: { label: 'Cliques no link (diário)', format: (v) => v.toLocaleString('pt-BR') },
  landing_page_views: { label: 'LPV diários', format: (v) => v.toLocaleString('pt-BR') },
};

export default function ForecastView() {
  const { state } = useAppState();
  const { current } = useFilteredRecords();
  const [metric, setMetric] = useState<MetricKey>('spend');
  const [method, setMethod] = useState<Method>('linear');
  const [horizon, setHorizon] = useState(7);
  const [confidence, setConfidence] = useState(0.9);

  const series = useMemo(() => {
    const byDay = new Map<string, { spend: number; results: number; impressions: number; link_clicks: number; landing_page_views: number }>();
    for (const r of current) {
      if (!r.period_start || r.period_start === 'unknown') continue;
      const d = r.period_start;
      const b = byDay.get(d) ?? { spend: 0, results: 0, impressions: 0, link_clicks: 0, landing_page_views: 0 };
      b.spend += r.spend_brl;
      b.results += r.results;
      b.impressions += r.impressions;
      b.link_clicks += r.link_clicks;
      b.landing_page_views += r.landing_page_views;
      byDay.set(d, b);
    }
    const dates = Array.from(byDay.keys()).sort();
    const values = dates.map((d) => byDay.get(d)![metric]);
    return { dates, values };
  }, [current, metric]);

  const forecast = useMemo(() => {
    if (series.values.length < 3) return null;
    if (method === 'linear') return linearForecast(series.values, horizon, { confidence });
    return holtsForecast(series.values, horizon, { confidence });
  }, [series, horizon, confidence, method]);

  const chart = useMemo(() => {
    const smoothed = movingAverage(series.values, 3);
    const actual = series.dates.map((d, i) => ({
      date: d.slice(5),
      fullDate: d,
      actual: series.values[i],
      smoothed: smoothed[i],
      forecast: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
    }));
    if (!forecast) return actual;
    const lastDate = series.dates[series.dates.length - 1];
    const last = new Date(lastDate + 'T00:00:00');
    const predicted = forecast.points.map((p, i) => {
      const date = new Date(last.getTime() + (i + 1) * 86400000);
      const iso = date.toISOString().slice(0, 10);
      return {
        date: iso.slice(5),
        fullDate: iso,
        actual: null,
        smoothed: null,
        forecast: p.value,
        lower: p.lower,
        upper: p.upper,
      };
    });
    return [...actual, ...predicted];
  }, [series, forecast]);

  const def = METRIC_LABELS[metric];

  if (current.length === 0) {
    return (
      <div className="text-center py-16 bg-card border border-border rounded-meta-card">
        <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />
        <p className="text-meta-body text-muted-foreground mt-2">Sem dados no período selecionado.</p>
      </div>
    );
  }

  if (series.values.length < 3) {
    return (
      <div className="text-center py-16 bg-card border border-border rounded-meta-card">
        <Info className="h-12 w-12 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />
        <p className="text-meta-body text-muted-foreground mt-2">
          Pelo menos 3 dias de dados são necessários para projetar. Dias disponíveis: {series.values.length}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-meta-heading-sm">
                <TrendingUp className="h-4 w-4 text-primary" strokeWidth={1.5} />
                Forecast
              </CardTitle>
              <CardDescription>
                Projeção transparente com intervalo de confiança. Linear = tendência linear simples. Holt = tendência + suavização exponencial (melhor quando a curva muda de inclinação).
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {series.values.length} dias de histórico
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Métrica</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(METRIC_LABELS) as MetricKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{METRIC_LABELS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Método</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear (OLS)</SelectItem>
                <SelectItem value="holt">Holt (tendência suavizada)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Horizonte (dias)</span>
              <span className="tabular-nums text-foreground">{horizon}</span>
            </Label>
            <Slider min={1} max={30} step={1} value={[horizon]} onValueChange={([v]) => setHorizon(v)} className="mt-3" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Confiança</span>
              <span className="tabular-nums text-foreground">{(confidence * 100).toFixed(0)}%</span>
            </Label>
            <Select value={String(confidence)} onValueChange={(v) => setConfidence(Number(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.8">80%</SelectItem>
                <SelectItem value="0.9">90%</SelectItem>
                <SelectItem value="0.95">95%</SelectItem>
                <SelectItem value="0.99">99%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-meta-body">{def.label}</CardTitle>
          <CardDescription className="text-[11px]">
            Histórico até hoje · projeção próximos {horizon} dias com banda de confiança {(confidence * 100).toFixed(0)}%.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={(v) => def.format(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  labelFormatter={(l, payload) => payload?.[0]?.payload?.fullDate || l}
                  formatter={(v: number | null, name: string) => v === null ? '—' : [def.format(v), name]}
                />
                <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />

                {/* Confidence band (drawn first as stacked area) */}
                <Area
                  type="monotone"
                  dataKey="upper"
                  name={`IC ${(confidence * 100).toFixed(0)}% (superior)`}
                  stroke="none"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.12}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  name={`IC ${(confidence * 100).toFixed(0)}% (inferior)`}
                  stroke="none"
                  fill="hsl(var(--background))"
                  fillOpacity={1}
                  isAnimationActive={false}
                />

                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Real"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.8}
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="smoothed"
                  name="Média móvel 3d"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Projeção"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                />

                {series.dates.length > 0 && (
                  <ReferenceLine x={series.dates[series.dates.length - 1].slice(5)} stroke="hsl(var(--warning))" strokeDasharray="2 2" />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {forecast && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-meta-body">Sumário da projeção</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-meta-btn border border-border p-3">
              <div className="text-[11px] text-muted-foreground uppercase">Soma projetada ({horizon}d)</div>
              <div className="text-meta-heading-sm text-foreground tabular-nums">{def.format(forecast.cumulative)}</div>
              <div className="text-[11px] text-muted-foreground">
                IC {(confidence * 100).toFixed(0)}%: {def.format(forecast.cumulativeLower)} — {def.format(forecast.cumulativeUpper)}
              </div>
            </div>
            <div className="rounded-meta-btn border border-border p-3">
              <div className="text-[11px] text-muted-foreground uppercase">Tendência diária (slope)</div>
              <div className="text-meta-heading-sm text-foreground tabular-nums">
                {forecast.fit.slope >= 0 ? '+' : ''}{def.format(forecast.fit.slope)}/dia
              </div>
              <div className="text-[11px] text-muted-foreground">
                R² = {forecast.fit.rSquared.toFixed(2)} · {forecast.fit.rSquared > 0.7 ? 'tendência consistente' : forecast.fit.rSquared > 0.4 ? 'tendência moderada' : 'tendência fraca — use com cautela'}
              </div>
            </div>
            <div className="rounded-meta-btn border border-border p-3">
              <div className="text-[11px] text-muted-foreground uppercase">Último dia vs projeção D+1</div>
              <div className="text-meta-heading-sm text-foreground tabular-nums">
                {def.format(series.values[series.values.length - 1])} → {def.format(forecast.points[0]?.value ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Δ = {def.format((forecast.points[0]?.value ?? 0) - series.values[series.values.length - 1])}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-meta-body">Como ler uma projeção</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            Projeções em marketing são sempre incertas. A banda sombreada mostra onde o valor "provavelmente" cairá — mas essa garantia depende de o comportamento futuro ser parecido com o histórico. Mudanças de criativo, budget ou sazonalidade podem invalidar a curva.
          </p>
          <p>
            <strong className="text-foreground">Quando usar linear:</strong> série estável ou tendência constante. <strong className="text-foreground">Quando usar Holt:</strong> quando a tendência mudou nos últimos dias. Holt responde mais rápido mas exagera em séries ruidosas.
          </p>
          <p>
            <strong className="text-foreground">R² baixo (&lt;0.4)</strong>: a série é tão ruidosa que a regressão explica pouco. Nesse caso, a média móvel é uma estimativa melhor do que a tendência.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
