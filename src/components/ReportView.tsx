import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import {
  aggregateMetrics,
  filterByPeriodWithFallback,
  groupByLevel,
  formatCurrency,
  formatNumber,
  formatPercent,
  getPeriodLabel,
  computeFunnel,
  METRIC_DEFS,
} from '@/lib/calculations';
import { FileText, Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ReportView() {
  const { state } = useAppState();
  const periodKey = state.selectedPeriodKey;
  const compPeriodKey = state.comparisonPeriodKey;

  const report = useMemo(() => {
    if (!periodKey) return null;

    const current = filterByPeriodWithFallback(state.records, periodKey, state.truthSource);
    const previous = compPeriodKey
      ? filterByPeriodWithFallback(state.records, compPeriodKey, state.truthSource)
      : [];

    const cm = aggregateMetrics(current);
    const pm = previous.length > 0 ? aggregateMetrics(previous) : null;
    const rows = groupByLevel(current, previous, 'campaign', '', false);

    const highlights: { positive: string[]; negative: string[] } = { positive: [], negative: [] };
    const metricChecks = [
      { key: 'cost_per_result', label: 'CPA', invert: true, format: formatCurrency },
      { key: 'ctr_link', label: 'CTR Link', invert: false, format: (v: number) => formatPercent(v) },
      { key: 'cpc_link', label: 'CPC Link', invert: true, format: formatCurrency },
      { key: 'cpm', label: 'CPM', invert: true, format: formatCurrency },
      { key: 'lpv_rate', label: 'LPV Rate', invert: false, format: (v: number) => formatPercent(v * 100) },
      { key: 'qualified_ctr', label: 'Qualified CTR', invert: false, format: (v: number) => formatPercent(v) },
    ];

    if (pm) {
      for (const mc of metricChecks) {
        const curr = (cm as any)[mc.key];
        const prev = (pm as any)[mc.key];
        if (prev === 0) continue;
        const change = ((curr - prev) / Math.abs(prev)) * 100;
        const isGood = mc.invert ? change < 0 : change > 0;
        const text = `${mc.label}: ${mc.format(curr)} (${change > 0 ? '+' : ''}${change.toFixed(1)}%)`;
        if (isGood) highlights.positive.push(text);
        else highlights.negative.push(text);
      }
    }

    const periodLabel = getPeriodLabel(periodKey, state.selectedGranularity);
    const compLabel = compPeriodKey ? getPeriodLabel(compPeriodKey, state.selectedGranularity) : null;

    let summary = `Em ${periodLabel}, o investimento total foi de ${formatCurrency(cm.spend_brl)} com ${formatNumber(cm.impressions)} impressões, ${formatNumber(cm.link_clicks)} cliques no link e ${formatNumber(cm.results)} resultados.`;

    if (pm && compLabel) {
      const spendDelta = ((cm.spend_brl - pm.spend_brl) / (pm.spend_brl || 1)) * 100;
      const resultsDelta = ((cm.results - pm.results) / (pm.results || 1)) * 100;
      summary += ` Comparado a ${compLabel}, o investimento ${spendDelta > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(spendDelta).toFixed(1)}% e os resultados ${resultsDelta > 0 ? 'aumentaram' : 'diminuíram'} ${Math.abs(resultsDelta).toFixed(1)}%.`;
    }

    const funnel = state.funnelData.find(f => f.period_key === periodKey);
    const funnelComputed = funnel ? computeFunnel(funnel, cm) : null;
    if (funnelComputed && funnelComputed.roas > 0) {
      summary += ` O ROAS foi de ${funnelComputed.roas.toFixed(2)}x com ticket médio de ${formatCurrency(funnelComputed.ticket_medio)}.`;
    }

    const recommendations: string[] = [];
    if (cm.ctr_link < 1) recommendations.push('CTR Link abaixo de 1% — revisar criativos e copy dos anúncios');
    if (cm.frequency > 3) recommendations.push('Frequência alta (>' + cm.frequency.toFixed(1) + ') — considerar expandir público ou renovar criativos');
    if (cm.lpv_rate < 0.6) recommendations.push('LPV Rate baixo — desalinhamento entre anúncio e landing page');
    if (recommendations.length === 0) recommendations.push('Resultados estáveis — continuar otimizações incrementais');

    return { summary, highlights, recommendations, cm, pm, periodLabel, compLabel, rows };
  }, [state, periodKey, compPeriodKey]);

  const exportPDF = () => {
    if (!report || !periodKey) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Meta Ads — Relatório', 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`${report.periodLabel}${report.compLabel ? ` vs ${report.compLabel}` : ''}`, 14, y);
    y += 10;

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('KPIs', 14, y);
    y += 2;

    const kpiData = METRIC_DEFS.slice(0, 12).map(def => {
      const val = (report.cm as any)[def.key] ?? 0;
      const prevVal = report.pm ? (report.pm as any)[def.key] ?? 0 : null;
      const delta = prevVal !== null && prevVal !== 0
        ? `${(((val - prevVal) / Math.abs(prevVal)) * 100).toFixed(1)}%`
        : '—';
      return [def.label, def.format(val), prevVal !== null ? def.format(prevVal) : '—', delta];
    });

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Atual', 'Anterior', 'Δ %']],
      body: kpiData,
      theme: 'grid',
      headStyles: { fillColor: [30, 144, 255], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    doc.save(`relatorio-meta-ads-${periodKey}.pdf`);
  };

  if (!report) return <p className="text-muted-foreground text-center py-8">Selecione um período</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Relatório — {report.periodLabel}
          {report.compLabel && <span className="text-muted-foreground font-normal text-sm">vs {report.compLabel}</span>}
        </h2>
        <Button size="sm" onClick={exportPDF}>
          <Download className="h-4 w-4 mr-1" /> PDF
        </Button>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Resumo Executivo</h3>
        <p className="text-foreground leading-relaxed">{report.summary}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-positive mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Destaques Positivos
          </h3>
          <ul className="space-y-2">
            {report.highlights.positive.slice(0, 5).map((h, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-positive flex-shrink-0 mt-0.5" />{h}
              </li>
            ))}
            {report.highlights.positive.length === 0 && (
              <li className="text-sm text-muted-foreground">Sem dados de comparação</li>
            )}
          </ul>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-negative mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Pontos de Atenção
          </h3>
          <ul className="space-y-2">
            {report.highlights.negative.slice(0, 5).map((h, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-negative flex-shrink-0 mt-0.5" />{h}
              </li>
            ))}
            {report.highlights.negative.length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhum problema crítico</li>
            )}
          </ul>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-primary mb-3 uppercase tracking-wider">Recomendações</h3>
        <ul className="space-y-2">
          {report.recommendations.map((r, i) => (
            <li key={i} className="text-sm text-foreground flex items-start gap-2">
              <span className="text-primary font-bold">{i + 1}.</span>{r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
