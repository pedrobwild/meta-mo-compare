import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import {
  aggregateMetrics,
  filterByTruthSourceWithFallback,
  groupByLevel,
  formatCurrency,
  formatNumber,
  formatPercent,
  getMonthLabel,
  computeFunnel,
  type GroupedRow,
} from '@/lib/calculations';
import { FileText, Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReportView() {
  const { state } = useAppState();
  const month = state.selectedMonth;
  const compMonth = state.comparisonMonth;

  const report = useMemo(() => {
    if (!month) return null;

    const current = filterByTruthSourceWithFallback(state.records, month, state.truthSource);
    const previous = compMonth
      ? filterByTruthSourceWithFallback(state.records, compMonth, state.truthSource)
      : [];

    const cm = aggregateMetrics(current);
    const pm = previous.length > 0 ? aggregateMetrics(previous) : null;

    const rows = groupByLevel(current, previous, 'campaign', '', false);

    // Top 3 positive highlights (weighted by spend)
    const highlights: { positive: string[]; negative: string[] } = { positive: [], negative: [] };

    const metricChecks = [
      { key: 'cost_per_result', label: 'CPA', invert: true, format: formatCurrency },
      { key: 'ctr_link', label: 'CTR Link', invert: false, format: (v: number) => formatPercent(v) },
      { key: 'cpc_link', label: 'CPC Link', invert: true, format: formatCurrency },
      { key: 'cpm', label: 'CPM', invert: true, format: formatCurrency },
    ];

    if (pm) {
      for (const mc of metricChecks) {
        const curr = (cm as any)[mc.key];
        const prev = (pm as any)[mc.key];
        if (prev === 0) continue;
        const change = ((curr - prev) / Math.abs(prev)) * 100;
        const isGood = mc.invert ? change < 0 : change > 0;
        const text = `${mc.label}: ${mc.format(curr)} (${change > 0 ? '+' : ''}${change.toFixed(1)}% MoM)`;
        if (isGood) highlights.positive.push(text);
        else highlights.negative.push(text);
      }

      // Top campaigns by improvement
      for (const row of rows.slice(0, 10)) {
        const d = row.delta.deltas['cost_per_result'];
        if (d && d.percent !== null) {
          if (d.percent < -10 && row.metrics.spend_brl > cm.spend_brl * 0.05) {
            highlights.positive.push(`"${row.name}": CPA reduziu ${Math.abs(d.percent).toFixed(0)}%`);
          }
          if (d.percent > 15 && row.metrics.spend_brl > cm.spend_brl * 0.05) {
            highlights.negative.push(`"${row.name}": CPA subiu ${d.percent.toFixed(0)}%`);
          }
        }
      }
    }

    // Executive text
    const monthLabel = getMonthLabel(month);
    const compLabel = compMonth ? getMonthLabel(compMonth) : null;
    
    let summary = `Em ${monthLabel}, o investimento total foi de ${formatCurrency(cm.spend_brl)} com ${formatNumber(cm.impressions)} impressões, ${formatNumber(cm.link_clicks)} cliques no link e ${formatNumber(cm.results)} resultados.`;

    if (pm && compLabel) {
      const spendDelta = ((cm.spend_brl - pm.spend_brl) / (pm.spend_brl || 1)) * 100;
      const resultsDelta = ((cm.results - pm.results) / (pm.results || 1)) * 100;
      summary += ` Comparado a ${compLabel}, o investimento ${spendDelta > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(spendDelta).toFixed(1)}% e os resultados ${resultsDelta > 0 ? 'aumentaram' : 'diminuíram'} ${Math.abs(resultsDelta).toFixed(1)}%.`;
    }

    // Funnel
    const funnel = state.funnelData.find(f => f.month_key === month);
    const funnelComputed = funnel ? computeFunnel(funnel, cm) : null;
    if (funnelComputed && funnelComputed.roas > 0) {
      summary += ` O ROAS foi de ${funnelComputed.roas.toFixed(2)}x com ticket médio de ${formatCurrency(funnelComputed.ticket_medio)}.`;
    }

    // Recommendations
    const recommendations: string[] = [];
    if (cm.ctr_link < 1) recommendations.push('CTR Link abaixo de 1% — revisar criativos e copy dos anúncios');
    if (cm.frequency > 3) recommendations.push('Frequência alta (>' + cm.frequency.toFixed(1) + ') — considerar expandir público ou renovar criativos');
    if (cm.cost_per_result > 0 && pm && pm.cost_per_result > 0 && cm.cost_per_result > pm.cost_per_result * 1.2) {
      recommendations.push('CPA aumentou >20% — analisar segmentações e pausar anúncios com CPA elevado');
    }
    if (rows.some(r => r.metrics.spend_brl > cm.spend_brl * 0.3 && r.metrics.results === 0)) {
      recommendations.push('Campanhas com alto spend e zero resultados — revisar urgentemente');
    }
    if (recommendations.length === 0) recommendations.push('Resultados estáveis — continuar otimizações incrementais');

    return { summary, highlights, recommendations, cm, pm, monthLabel, compLabel };
  }, [state, month, compMonth]);

  const exportCSV = () => {
    if (!month) return;
    const current = filterByTruthSourceWithFallback(state.records, month, state.truthSource);
    const headers = ['Nome', 'Investimento', 'Impressões', 'Cliques', 'CTR', 'CPC', 'CPM', 'Resultados', 'CPA', 'LPV'];
    const rows = groupByLevel(current, [], state.analysisLevel, state.searchQuery, state.includeInactive);
    const csvRows = rows.map(r => [
      `"${r.name}"`, r.metrics.spend_brl, r.metrics.impressions, r.metrics.link_clicks,
      r.metrics.ctr_link, r.metrics.cpc_link, r.metrics.cpm, r.metrics.results,
      r.metrics.cost_per_result, r.metrics.landing_page_views
    ].join(','));

    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta-ads-${month}.csv`;
    a.click();
  };

  if (!report) return <p className="text-muted-foreground text-center py-8">Selecione um mês</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Relatório — {report.monthLabel}
          {report.compLabel && <span className="text-muted-foreground font-normal text-sm">vs {report.compLabel}</span>}
        </h2>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Resumo Executivo</h3>
        <p className="text-foreground leading-relaxed">{report.summary}</p>
      </div>

      {/* Highlights */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-positive mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Destaques Positivos
          </h3>
          <ul className="space-y-2">
            {report.highlights.positive.slice(0, 3).map((h, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-positive flex-shrink-0 mt-0.5" />
                {h}
              </li>
            ))}
            {report.highlights.positive.length === 0 && (
              <li className="text-sm text-muted-foreground">Sem dados de comparação disponíveis</li>
            )}
          </ul>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-negative mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Pontos de Atenção
          </h3>
          <ul className="space-y-2">
            {report.highlights.negative.slice(0, 3).map((h, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-negative flex-shrink-0 mt-0.5" />
                {h}
              </li>
            ))}
            {report.highlights.negative.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhum problema crítico identificado</li>
            )}
          </ul>
        </div>
      </div>

      {/* Recommendations */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-primary mb-3 uppercase tracking-wider">Recomendações</h3>
        <ul className="space-y-2">
          {report.recommendations.map((r, i) => (
            <li key={i} className="text-sm text-foreground flex items-start gap-2">
              <span className="text-primary font-bold">{i + 1}.</span>
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
