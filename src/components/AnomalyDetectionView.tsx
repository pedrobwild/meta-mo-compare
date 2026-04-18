// ─── Anomaly Detection View ───
// Rolling MAD-based anomaly detection on daily metrics. Lets the user tune
// the threshold, pick the metric, and inspect the list of flagged dates with
// charts that highlight the outlier days in red/amber.

import { useMemo, useState } from 'react';
import { AlertOctagon, ArrowUp, ArrowDown, Info } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend,
} from 'recharts';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { detectAnomalies, type AnomalyPoint } from '@/lib/stats/anomalies';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type MetricKey = 'spend' | 'results' | 'impressions' | 'link_clicks' | 'ctr' | 'cpc' | 'cpa' | 'cpm';

const METRIC_OPTIONS: Array<{ key: MetricKey; label: string; format: (v: number) => string; goodDirection: 'up' | 'down' }> = [
  { key: 'spend', label: 'Spend diário', format: (v) => `R$ ${v.toFixed(0)}`, goodDirection: 'up' },
  { key: 'results', label: 'Resultados diários', format: (v) => v.toFixed(0), goodDirection: 'up' },
  { key: 'impressions', label: 'Impressões diárias', format: (v) => v.toLocaleString('pt-BR'), goodDirection: 'up' },
  { key: 'link_clicks', label: 'Cliques no link', format: (v) => v.toLocaleString('pt-BR'), goodDirection: 'up' },
  { key: 'ctr', label: 'CTR Link (%)', format: (v) => `${v.toFixed(2)}%`, goodDirection: 'up' },
  { key: 'cpc', label: 'CPC Link', format: (v) => `R$ ${v.toFixed(2)}`, goodDirection: 'down' },
  { key: 'cpa', label: 'CPA (R$/resultado)', format: (v) => `R$ ${v.toFixed(2)}`, goodDirection: 'down' },
  { key: 'cpm', label: 'CPM', format: (v) => `R$ ${v.toFixed(2)}`, goodDirection: 'down' },
];

export default function AnomalyDetectionView() {
  const { state } = useAppState();
  const { current } = useFilteredRecords();
  const [metric, setMetric] = useState<MetricKey>('spend');
  const [threshold, setThreshold] = useState(3); // MAD-z threshold
  const [windowSize, setWindowSize] = useState(14);

  const series = useMemo(() => {
    // Build daily totals for current period, across ALL records (truth-source-filtered).
    const byDay = new Map<string, { spend: number; impressions: number; link_clicks: number; results: number }>();
    for (const r of current) {
      if (!r.period_start || r.period_start === 'unknown') continue;
      const d = r.period_start;
      const bucket = byDay.get(d) ?? { spend: 0, impressions: 0, link_clicks: 0, results: 0 };
      bucket.spend += r.spend_brl;
      bucket.impressions += r.impressions;
      bucket.link_clicks += r.link_clicks;
      bucket.results += r.results;
      byDay.set(d, bucket);
    }

    const dates = Array.from(byDay.keys()).sort();
    const rows = dates.map((d) => {
      const b = byDay.get(d)!;
      const ctr = b.impressions > 0 ? (b.link_clicks / b.impressions) * 100 : 0;
      const cpc = b.link_clicks > 0 ? b.spend / b.link_clicks : 0;
      const cpa = b.results > 0 ? b.spend / b.results : 0;
      const cpm = b.impressions > 0 ? (b.spend / b.impressions) * 1000 : 0;
      return { date: d, spend: b.spend, impressions: b.impressions, link_clicks: b.link_clicks, results: b.results, ctr, cpc, cpa, cpm };
    });
    return { dates, rows };
  }, [current]);

  const metricDef = METRIC_OPTIONS.find((o) => o.key === metric)!;

  const detected = useMemo(() => {
    const values = series.rows.map((r) => r[metric] as number);
    return detectAnomalies(values, { threshold, window: windowSize, dates: series.dates });
  }, [series, metric, threshold, windowSize]);

  const chartData = useMemo(() => {
    return series.rows.map((r, i) => {
      const pt: AnomalyPoint = detected.points[i];
      return {
        date: r.date.slice(5), // show MM-DD
        fullDate: r.date,
        value: r[metric] as number,
        baseline: pt.baseline,
        isAnomaly: pt.isAnomaly,
        direction: pt.direction,
        severity: pt.severity,
        zScore: pt.zScore,
      };
    });
  }, [series, detected, metric]);

  const anomaliesList = useMemo(() => {
    const list = detected.points
      .map((p, i) => ({ ...p, row: series.rows[i] }))
      .filter((p) => p.isAnomaly)
      .sort((a, b) => (b.row?.date ?? '').localeCompare(a.row?.date ?? ''));
    return list;
  }, [detected, series]);

  if (current.length === 0) {
    return (
      <div className="text-center py-16 space-y-3 bg-card border border-border rounded-meta-card">
        <AlertOctagon className="h-12 w-12 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />
        <p className="text-meta-body text-muted-foreground">Sem dados no período selecionado.</p>
      </div>
    );
  }

  if (series.dates.length < 7) {
    return (
      <div className="text-center py-16 space-y-3 bg-card border border-border rounded-meta-card">
        <AlertOctagon className="h-12 w-12 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />
        <p className="text-meta-body text-muted-foreground">Detecção requer pelo menos 7 dias. Amplie o período.</p>
        <p className="text-[11px] text-muted-foreground">Dias com dados: {series.dates.length}</p>
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
                <AlertOctagon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                Detecção de anomalias
              </CardTitle>
              <CardDescription>
                Z-score robusto (MAD) em janela deslizante. Ignora outliers isolados ao estimar a baseline — evita cascata de falsos positivos após um único dia atípico.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-[11px]">
              {series.dates.length} dias · {current.length} registros
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-[11px] text-muted-foreground">Métrica</Label>
            <Select value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METRIC_OPTIONS.map((o) => (
                  <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Sensibilidade (z-threshold)</span>
              <span className="tabular-nums text-foreground">{threshold.toFixed(1)}</span>
            </Label>
            <Slider
              min={1.5}
              max={5}
              step={0.1}
              value={[threshold]}
              onValueChange={([v]) => setThreshold(v)}
              className="mt-3"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Menor = mais alertas · 3 é o default (regra 3-sigma robusta)</p>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Janela histórica (dias)</span>
              <span className="tabular-nums text-foreground">{windowSize}</span>
            </Label>
            <Slider
              min={5}
              max={30}
              step={1}
              value={[windowSize]}
              onValueChange={([v]) => setWindowSize(v)}
              className="mt-3"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Janela de referência para comparar cada dia com a mediana recente</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-meta-body">{metricDef.label}</CardTitle>
          <CardDescription className="text-[11px]">
            Linha cinza = valor real · linha tracejada = baseline recente · pontos vermelhos = anomalia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickFormatter={(v) => metricDef.format(v)} width={70} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  labelFormatter={(l, payload) => payload?.[0]?.payload?.fullDate || l}
                  formatter={(v: number, name: string) => [metricDef.format(v), name === 'value' ? metricDef.label : 'Baseline']}
                />
                <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={metricDef.label}
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Baseline"
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
                {chartData.map((d, i) =>
                  d.isAnomaly ? (
                    <ReferenceDot
                      key={i}
                      x={d.date}
                      y={d.value}
                      r={5}
                      fill={anomalyColor(metricDef.goodDirection, d.direction, d.severity)}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  ) : null,
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-meta-body">
            Anomalias detectadas ({anomaliesList.length})
          </CardTitle>
          <CardDescription className="text-[11px]">
            Ordenadas da mais recente para a mais antiga.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {anomaliesList.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Info className="h-4 w-4" /> Nada fora do padrão nesta janela de tempo e threshold.
            </div>
          ) : (
            <div className="space-y-2">
              {anomaliesList.map((a, i) => {
                const color = anomalyColor(metricDef.goodDirection, a.direction, a.severity);
                const isBad =
                  (metricDef.goodDirection === 'up' && a.direction === 'down') ||
                  (metricDef.goodDirection === 'down' && a.direction === 'up');
                return (
                  <div key={i} className="flex items-center gap-3 border border-border rounded-meta-btn px-3 py-2">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground flex items-center gap-2">
                        <span>{a.row?.date}</span>
                        {a.direction === 'up' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        <span className="tabular-nums">{metricDef.format(a.value)}</span>
                        <span className="text-muted-foreground text-[11px]">
                          (baseline {metricDef.format(a.baseline)}, z = {a.zScore.toFixed(1)})
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className={isBad ? 'border-negative/30 text-negative' : 'border-positive/30 text-positive'}>
                      {isBad ? 'Atenção' : 'Pico positivo'}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">{a.severity}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-meta-body">Como este detector funciona</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Z-score robusto</strong>: para cada dia, comparamos o valor contra a mediana dos últimos {windowSize} dias, dividido pelo MAD (mediana dos desvios absolutos × 1.4826). Isso é mais estável que média+desvio-padrão porque um único dia atípico não contamina a baseline.
          </p>
          <p>
            <strong className="text-foreground">Threshold</strong>: {threshold.toFixed(1)} equivale a "quase nunca acontece em dados normais" — usa a mesma lógica de controle estatístico de processos. Abaixe para 2.0–2.5 se quiser mais alertas durante mudanças de estratégia.
          </p>
          <p>
            <strong className="text-foreground">Direção boa vs ruim</strong>: cálculo depende da métrica — spend/resultados/CTR subir é bom; CPC/CPA/CPM subir é ruim. O badge "Atenção" vs "Pico positivo" leva isso em conta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function anomalyColor(
  goodDirection: 'up' | 'down',
  anomalyDirection: 'up' | 'down',
  severity: 'low' | 'medium' | 'high',
): string {
  const isBad = goodDirection !== anomalyDirection;
  if (isBad) {
    return severity === 'high' ? 'hsl(var(--destructive))' : severity === 'medium' ? 'hsl(var(--warning, 45 90% 55%))' : 'hsl(var(--muted-foreground))';
  }
  return severity === 'high' ? 'hsl(var(--positive, 140 70% 45%))' : 'hsl(var(--primary))';
}
