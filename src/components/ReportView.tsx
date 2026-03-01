import { useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  groupByLevel,
  formatCurrency,
  formatNumber,
  formatPercent,
  getDateRangeLabel,
  computeFunnel,
  METRIC_DEFS,
} from '@/lib/calculations';
import { computeVerdict } from '@/lib/insights/verdicts';
import { VERTICALS, DEFAULT_VERTICAL, getBenchmarkStatus } from '@/lib/benchmarks';
import { explainChange } from '@/lib/metrics/explain';
import { aggregateInsights, type InsightRow } from '@/lib/metrics/aggregate';
import { generateRecommendations } from '@/lib/alerts/engine';
import { FileText, Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ArrowDown, ArrowUp, Minus, Lightbulb, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MetaRecord } from '@/lib/types';

function toInsightRow(records: MetaRecord[]): InsightRow[] {
  return records.map(r => ({
    spend: r.spend_brl,
    impressions: r.impressions,
    reach: r.reach,
    clicks: r.clicks_all,
    inline_link_clicks: r.link_clicks,
    landing_page_views: r.landing_page_views,
    results_leads: r.results,
    purchases: 0,
    purchase_value: 0,
  }));
}

export default function ReportView() {
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();

  const report = useMemo(() => {
    if (current.length === 0) return null;

    const cm = aggregateMetrics(current);
    const pm = previous.length > 0 ? aggregateMetrics(previous) : null;
    const rows = groupByLevel(current, previous, 'campaign', '', false);

    // ─── Metrics Layer aggregation for explain ───
    const currentAgg = aggregateInsights(toInsightRow(current));
    const previousAgg = previous.length > 0 ? aggregateInsights(toInsightRow(previous)) : null;

    // ─── "O que mudou" — Explain key metrics ───
    const keyMetrics = ['cpa_lead', 'cpc_link', 'roas', 'cpm'];
    const explanations = previousAgg
      ? keyMetrics
          .map(m => explainChange(m, currentAgg, previousAgg!))
          .filter(e => Math.abs(e.changePercent) > 2)
          .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      : [];

    // ─── "O que faremos" — Auto-generated action plan ───
    const autoRecs = generateRecommendations(currentAgg, previousAgg);

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

    const periodLabel = state.dateFrom && state.dateTo
      ? getDateRangeLabel(state.dateFrom, state.dateTo) : 'Período selecionado';
    const compLabel = state.comparisonFrom && state.comparisonTo
      ? getDateRangeLabel(state.comparisonFrom, state.comparisonTo) : null;

    let summary = `Em ${periodLabel}, o investimento total foi de ${formatCurrency(cm.spend_brl)} com ${formatNumber(cm.impressions)} impressões, ${formatNumber(cm.link_clicks)} cliques no link e ${formatNumber(cm.results)} resultados.`;

    if (pm && compLabel) {
      const spendDelta = ((cm.spend_brl - pm.spend_brl) / (pm.spend_brl || 1)) * 100;
      const resultsDelta = ((cm.results - pm.results) / (pm.results || 1)) * 100;
      summary += ` Comparado a ${compLabel}, o investimento ${spendDelta > 0 ? 'aumentou' : 'diminuiu'} ${Math.abs(spendDelta).toFixed(1)}% e os resultados ${resultsDelta > 0 ? 'aumentaram' : 'diminuíram'} ${Math.abs(resultsDelta).toFixed(1)}%.`;
    }

    const funnel = state.funnelData.find(f => f.period_key === state.dateFrom);
    const funnelComputed = funnel ? computeFunnel(funnel, cm) : null;
    if (funnelComputed && funnelComputed.roas > 0) {
      summary += ` O ROAS foi de ${funnelComputed.roas.toFixed(2)}x com ticket médio de ${formatCurrency(funnelComputed.ticket_medio)}.`;
    }

    const recommendations: string[] = [];
    if (cm.ctr_link < 1) recommendations.push('CTR Link abaixo de 1% — revisar criativos e copy dos anúncios');
    if (cm.frequency > 3) recommendations.push('Frequência alta (>' + cm.frequency.toFixed(1) + ') — considerar expandir público ou renovar criativos');
    if (cm.lpv_rate < 0.6) recommendations.push('LPV Rate baixo — desalinhamento entre anúncio e landing page');
    if (recommendations.length === 0) recommendations.push('Resultados estáveis — continuar otimizações incrementais');

    const verdicts = rows.map(row => ({
      name: row.name,
      verdict: computeVerdict(row, cm),
      spend: row.metrics.spend_brl,
      results: row.metrics.results,
      cpa: row.metrics.cost_per_result,
    }));

    return { summary, highlights, recommendations, cm, pm, periodLabel, compLabel, rows, verdicts, explanations, autoRecs };
  }, [current, previous, state]);

  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = 15;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Meta Ads — Relatório Executivo', 14, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`${report.periodLabel}${report.compLabel ? ` vs ${report.compLabel}` : ''}`, 14, y);
    y += 10;

    doc.setTextColor(0);
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(report.summary, 180);
    doc.text(summaryLines, 14, y);
    y += summaryLines.length * 5 + 5;

    // ─── "O que mudou" section in PDF ───
    if (report.explanations.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('O que mudou', 14, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      report.explanations.forEach(exp => {
        const lines = doc.splitTextToSize(exp.narrative, 180);
        doc.text(lines, 14, y);
        y += lines.length * 4 + 3;
      });
      y += 3;
    }

    // ─── "O que faremos" section in PDF ───
    if (report.autoRecs.length > 0) {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('O que faremos', 14, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      report.autoRecs.forEach((rec, i) => {
        const title = `${i + 1}. ${rec.title}`;
        doc.text(title, 14, y);
        y += 4;
        const whyLines = doc.splitTextToSize(`  Por quê: ${rec.why}`, 175);
        doc.text(whyLines, 14, y);
        y += whyLines.length * 4;
        const whatLines = doc.splitTextToSize(`  Ação: ${rec.what_to_do}`, 175);
        doc.text(whatLines, 14, y);
        y += whatLines.length * 4 + 2;
      });
      y += 3;
    }

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
      const benchmarks = VERTICALS[DEFAULT_VERTICAL];
      const status = getBenchmarkStatus(def.key, val, benchmarks);
      const statusEmoji = status === 'good' ? '✅' : status === 'warning' ? '⚠️' : status === 'bad' ? '🔴' : '';
      return [def.label, def.format(val), prevVal !== null ? def.format(prevVal) : '—', delta, statusEmoji];
    });

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Atual', 'Anterior', 'Δ %', 'Status']],
      body: kpiData,
      theme: 'grid',
      headStyles: { fillColor: [30, 144, 255], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    if (report.verdicts.length > 0) {
      if (y > 230) { doc.addPage(); y = 15; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Semáforo por Campanha', 14, y);
      y += 2;

      const verdictData = report.verdicts.map(v => [
        `${v.verdict.emoji} ${v.verdict.label}`,
        v.name,
        `R$${v.spend.toFixed(2)}`,
        `${v.results}`,
        `R$${v.cpa.toFixed(2)}`,
        `${v.verdict.score}`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Veredito', 'Campanha', 'Invest.', 'Result.', 'CPA', 'Score']],
        body: verdictData,
        theme: 'grid',
        headStyles: { fillColor: [30, 144, 255], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }

    if (y > 250) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Recomendações', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    report.recommendations.forEach((r, i) => {
      doc.text(`${i + 1}. ${r}`, 14, y);
      y += 5;
    });

    doc.save(`relatorio-meta-ads-${state.dateFrom || 'report'}.pdf`);
  };

  if (!report) return <p className="text-muted-foreground text-center py-8">Selecione um período nos filtros</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Relatório — {report.periodLabel}
          {report.compLabel && <span className="text-muted-foreground font-normal text-sm">vs {report.compLabel}</span>}
        </h2>
        <Button size="sm" onClick={exportPDF}>
          <Download className="h-4 w-4 mr-1" /> PDF
        </Button>
      </div>

      {/* Resumo Executivo */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">Resumo Executivo</h3>
        <p className="text-foreground leading-relaxed">{report.summary}</p>
      </div>

      {/* ─── O QUE MUDOU ─── */}
      {report.explanations.length > 0 && (
        <div className="glass-card p-5 border-l-2 border-l-primary/50">
          <h3 className="text-sm font-medium text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> O que mudou
          </h3>
          <div className="space-y-4">
            {report.explanations.map((exp, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{exp.targetLabel}</span>
                  <Badge variant="outline" className={`text-[10px] ${exp.changePercent > 0 ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}`}>
                    {exp.changePercent > 0 ? '+' : ''}{exp.changePercent.toFixed(1)}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{exp.narrative}</p>
                {/* Driver waterfall */}
                <div className="flex flex-wrap gap-2 mt-1">
                  {exp.drivers.slice(0, 4).map(d => (
                    <div key={d.key} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/20 border border-border/20 text-xs">
                      {d.impact === 'positive' ? <ArrowUp className="h-3 w-3 text-emerald-400" /> :
                       d.impact === 'negative' ? <ArrowDown className="h-3 w-3 text-red-400" /> :
                       <Minus className="h-3 w-3 text-muted-foreground" />}
                      <span className="font-medium">{d.label}</span>
                      <span className={`font-mono ${d.percentChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {d.percentChange > 0 ? '+' : ''}{d.percentChange.toFixed(1)}%
                      </span>
                      <div className="w-10 h-1 bg-muted/30 rounded-full overflow-hidden ml-1">
                        <div
                          className={`h-full rounded-full ${d.impact === 'positive' ? 'bg-emerald-400' : d.impact === 'negative' ? 'bg-red-400' : 'bg-muted-foreground'}`}
                          style={{ width: `${Math.min(d.contribution * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Destaques / Atenção */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* ─── O QUE FAREMOS ─── */}
      {report.autoRecs.length > 0 && (
        <div className="glass-card p-5 border-l-2 border-l-amber-500/50">
          <h3 className="text-sm font-medium text-amber-400 mb-4 uppercase tracking-wider flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> O que faremos
          </h3>
          <div className="space-y-4">
            {report.autoRecs.map((rec, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/10 border border-border/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{rec.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    Confiança {Math.round(rec.confidence * 100)}%
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><span className="font-medium text-foreground/70">Por quê:</span> {rec.why}</p>
                  <p><span className="font-medium text-foreground/70">Ação:</span> {rec.what_to_do}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Semáforo */}
      {report.verdicts.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-medium text-foreground mb-3 uppercase tracking-wider">Semáforo por Campanha</h3>
          <div className="space-y-2">
            {report.verdicts.map(v => (
              <div key={v.name} className="flex items-center gap-3 p-2 rounded-md bg-secondary/30">
                <span className="text-sm">{v.verdict.emoji}</span>
                <span className="text-xs font-medium text-foreground flex-1 truncate">{v.name}</span>
                <span className={`text-xs font-medium ${v.verdict.color}`}>{v.verdict.label}</span>
                <span className="text-xs text-muted-foreground">Score {v.verdict.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recomendações legadas */}
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