// ─── PacingCard (with predictive forecast) ───
// Projects end-of-period spend & results using linear regression on the daily
// series so far, complete with 90% confidence intervals. Compares projection
// against configured targets so the user knows whether they'll overshoot,
// undershoot or land close.

import { useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  formatCurrency,
  formatNumber,
} from '@/lib/calculations';
import { linearForecast } from '@/lib/stats/forecast';
import { TrendingUp, Target, Calendar, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface MetricProjection {
  label: string;
  format: (v: number) => string;
  currentTotal: number;
  projectedTotal: number;
  projectedLow: number;
  projectedHigh: number;
  avgPerDay: number;
  target: number | null;
  pacingPct: number | null;
  daysElapsed: number;
  daysRemaining: number;
  confidence: number;
  enoughData: boolean;
  fitR2: number;
}

export default function PacingCard() {
  const { state } = useAppState();
  const { current } = useFilteredRecords();

  const pacing = useMemo(() => {
    if (current.length === 0 || !state.dateFrom || !state.dateTo) return null;

    const from = new Date(state.dateFrom + 'T00:00:00');
    const to = new Date(state.dateTo + 'T00:00:00');
    const totalDaysInRange = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    if (totalDaysInRange <= 0) return null;

    // Build a per-day spend/results series restricted to dates we actually have.
    const byDay = new Map<string, { spend: number; results: number }>();
    for (const r of current) {
      if (!r.period_start || r.period_start === 'unknown') continue;
      const d = r.period_start;
      const b = byDay.get(d) ?? { spend: 0, results: 0 };
      b.spend += r.spend_brl;
      b.results += r.results;
      byDay.set(d, b);
    }
    const dates = Array.from(byDay.keys()).sort();
    if (dates.length === 0) return null;

    const spendSeries = dates.map((d) => byDay.get(d)!.spend);
    const resultsSeries = dates.map((d) => byDay.get(d)!.results);

    const lastDate = dates[dates.length - 1];
    const last = new Date(lastDate + 'T00:00:00');
    // Days remaining from (lastDate + 1) through dateTo inclusive.
    const daysRemaining = Math.max(0, Math.round((to.getTime() - last.getTime()) / 86400000));

    const spendForecast = linearForecast(spendSeries, Math.max(daysRemaining, 1), { confidence: 0.9 });
    const resultsForecast = linearForecast(resultsSeries, Math.max(daysRemaining, 1), { confidence: 0.9 });

    const totals = aggregateMetrics(current);
    const daysElapsed = dates.length;
    const target = state.targets.find(
      (t) => t.period_key === state.dateFrom || t.period_key === state.dateFrom?.slice(0, 7),
    );

    const mk = (
      label: string,
      format: (v: number) => string,
      series: number[],
      forecast: ReturnType<typeof linearForecast>,
      totalValue: number,
      targetValue: number | null,
    ): MetricProjection => {
      const addRemaining = daysRemaining > 0 && forecast ? forecast.cumulative : 0;
      const lowRemaining = daysRemaining > 0 && forecast ? forecast.cumulativeLower : 0;
      const highRemaining = daysRemaining > 0 && forecast ? forecast.cumulativeUpper : 0;
      const projected = totalValue + addRemaining;
      const projectedLow = totalValue + lowRemaining;
      const projectedHigh = totalValue + highRemaining;
      const avgPerDay = daysElapsed > 0 ? series.reduce((s, v) => s + v, 0) / daysElapsed : 0;
      return {
        label,
        format,
        currentTotal: totalValue,
        projectedTotal: projected,
        projectedLow,
        projectedHigh,
        avgPerDay,
        target: targetValue,
        pacingPct: targetValue && targetValue > 0 ? (projected / targetValue) * 100 : null,
        daysElapsed,
        daysRemaining,
        confidence: 0.9,
        enoughData: (forecast && forecast.fit.n >= 3) || daysRemaining === 0,
        fitR2: forecast?.fit.rSquared || 0,
      };
    };

    const items: MetricProjection[] = [
      mk('Investimento', formatCurrency, spendSeries, spendForecast, totals.spend_brl, target?.spend ?? null),
      mk(
        'Resultados',
        (v) => formatNumber(v),
        resultsSeries,
        resultsForecast,
        totals.results,
        target?.results ?? null,
      ),
    ];

    return { items, daysElapsed, daysRemaining, totalDaysInRange };
  }, [current, state.dateFrom, state.dateTo, state.targets]);

  if (!pacing) return null;

  return (
    <div className="bg-card border border-border rounded-meta-card p-5 shadow-meta-subtle">
      <h3 className="text-meta-body font-semibold text-foreground mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" strokeWidth={1.5} />
        Projeção · {pacing.daysElapsed}/{pacing.totalDaysInRange} dias ({pacing.daysRemaining} restantes)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pacing.items.map((item) => {
          const pacingPct = item.pacingPct;
          const status: 'positive' | 'warning' | 'negative' | 'neutral' =
            pacingPct === null
              ? 'neutral'
              : Math.abs(pacingPct - 100) < 10
                ? 'positive'
                : pacingPct > 100
                  ? 'negative'
                  : 'warning';

          const statusColor =
            status === 'positive' ? 'text-positive' :
            status === 'warning' ? 'text-warning' :
            status === 'negative' ? 'text-negative' :
            'text-muted-foreground';

          return (
            <div key={item.label} className="space-y-2 p-3 rounded-meta-btn bg-secondary/30">
              <div className="flex justify-between items-center">
                <span className="meta-section-label">{item.label}</span>
                <span className="text-meta-label text-muted-foreground">
                  média {item.format(item.avgPerDay)}/dia
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-meta-title font-bold text-foreground">{item.format(item.currentTotal)}</span>
                <span className="text-meta-caption text-muted-foreground">realizado</span>
              </div>

              <div className="flex items-center gap-2 text-meta-caption">
                <TrendingUp className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
                <span className="text-foreground">
                  Projeção fim do período: <strong>{item.format(item.projectedTotal)}</strong>
                </span>
              </div>

              {item.daysRemaining > 0 && item.enoughData && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  IC {(item.confidence * 100).toFixed(0)}%: {item.format(item.projectedLow)} — {item.format(item.projectedHigh)}
                  {item.fitR2 > 0 && ` · R²=${item.fitR2.toFixed(2)}`}
                </div>
              )}
              {!item.enoughData && item.daysRemaining > 0 && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Poucos dias ({item.daysElapsed}) para uma projeção confiável. Use apenas como orientação.
                </div>
              )}

              {item.target !== null && pacingPct !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" /> Meta: {item.format(item.target)}
                    </span>
                    <span className={statusColor}>
                      {pacingPct.toFixed(0)}% da meta projetado
                    </span>
                  </div>
                  <Progress value={Math.min(120, pacingPct)} className="h-1.5" />
                  {status === 'negative' && (
                    <p className="text-[11px] text-negative">
                      Previsão de estouro: {item.format(item.projectedTotal - item.target)} acima da meta.
                    </p>
                  )}
                  {status === 'warning' && (
                    <p className="text-[11px] text-warning">
                      Previsão abaixo: faltam {item.format(item.target - item.projectedTotal)} para bater meta.
                    </p>
                  )}
                  {status === 'positive' && (
                    <p className="text-[11px] text-positive">No ritmo certo.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
