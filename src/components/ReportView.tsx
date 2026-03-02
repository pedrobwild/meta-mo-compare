import { useMemo, useState } from 'react';
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
import { FileText, Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ArrowDown, ArrowUp, Minus, Lightbulb, MessageSquare, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MetaRecord } from '@/lib/types';

type AINarrative = {
  resumo_executivo: string;
  o_que_mudou: string;
  por_que: string;
  o_que_faremos: string;
};

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
  const [aiNarrative, setAiNarrative] = useState<AINarrative | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const report = useMemo(() => {
    if (current.length === 0) return null;

    const cm = aggregateMetrics(current);
    const pm = previous.length > 0 ? aggregateMetrics(previous) : null;
    const rows = groupByLevel(current, previous, 'campaign', '', false);

    const currentAgg = aggregateInsights(toInsightRow(current));
    const previousAgg = previous.length > 0 ? aggregateInsights(toInsightRow(previous)) : null;

    const keyMetrics = ['cpa_lead', 'cpc_link', 'roas', 'cpm'];
    const explanations = previousAgg
      ? keyMetrics
          .map(m => explainChange(m, currentAgg, previousAgg!))
          .filter(e => Math.abs(e.changePercent) > 2)
          .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
      : [];

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
      ctr: row.metrics.ctr_link,
    }));

    // Top 5 campaigns for context
    const top5 = [...rows]
      .sort((a, b) => b.metrics.spend_brl - a.metrics.spend_brl)
      .slice(0, 5)
      .map(r => ({
        name: r.name,
        spend: r.metrics.spend_brl,
        results: r.metrics.results,
        cpa: r.metrics.cost_per_result,
        ctr: r.metrics.ctr_link,
        impressions: r.metrics.impressions,
        status: r.status,
      }));

    // Top/bottom 3 ads for creative highlights
    const adRows = groupByLevel(current, previous, 'ad', '', false);
    const sortedAds = [...adRows].sort((a, b) => b.metrics.ctr_link - a.metrics.ctr_link);
    const topAds = sortedAds.slice(0, 3).map(r => ({
      name: r.name,
      ctr: r.metrics.ctr_link,
      cpa: r.metrics.cost_per_result,
      spend: r.metrics.spend_brl,
      results: r.metrics.results,
    }));
    const bottomAds = sortedAds.filter(a => a.metrics.spend_brl > 0).slice(-3).reverse().map(r => ({
      name: r.name,
      ctr: r.metrics.ctr_link,
      cpa: r.metrics.cost_per_result,
      spend: r.metrics.spend_brl,
      results: r.metrics.results,
    }));

    return { summary, highlights, recommendations, cm, pm, periodLabel, compLabel, rows, verdicts, explanations, autoRecs, top5, topAds, bottomAds };
  }, [current, previous, state]);

  const generateAINarrative = async () => {
    if (!report) return;
    setIsGenerating(true);
    try {
      const metricsContext = {
        periodo: report.periodLabel,
        periodo_comparacao: report.compLabel,
        metricas_atuais: {
          investimento: report.cm.spend_brl,
          impressoes: report.cm.impressions,
          cliques_link: report.cm.link_clicks,
          resultados: report.cm.results,
          cpa: report.cm.cost_per_result,
          ctr_link: report.cm.ctr_link,
          cpc_link: report.cm.cpc_link,
          cpm: report.cm.cpm,
          frequencia: report.cm.frequency,
          lpv_rate: report.cm.lpv_rate,
          landing_page_views: report.cm.landing_page_views,
          roas: report.cm.spend_brl > 0 ? report.cm.results / report.cm.spend_brl : 0,
        },
        metricas_anteriores: report.pm ? {
          investimento: report.pm.spend_brl,
          impressoes: report.pm.impressions,
          cliques_link: report.pm.link_clicks,
          resultados: report.pm.results,
          cpa: report.pm.cost_per_result,
          ctr_link: report.pm.ctr_link,
          cpc_link: report.pm.cpc_link,
          cpm: report.pm.cpm,
          frequencia: report.pm.frequency,
          roas: report.pm.spend_brl > 0 ? report.pm.results / report.pm.spend_brl : 0,
        } : null,
        top5_campanhas: report.top5,
        alertas: report.highlights.negative,
        destaques_positivos: report.highlights.positive,
        pontos_atencao: report.highlights.negative,
        variacoes: report.explanations.map(e => ({
          metrica: e.targetLabel,
          variacao_pct: e.changePercent,
          narrativa: e.narrative,
        })),
      };

      const { data, error } = await supabase.functions.invoke('ai-report-narrative', {
        body: { metricsContext },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAiNarrative(data as AINarrative);
      toast.success('Narrativa gerada com sucesso!');
    } catch (err: any) {
      console.error('AI narrative error:', err);
      toast.error(err.message || 'Erro ao gerar narrativa');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    let y = 0;

    // ═══════════════════════════════════════════════════
    // CAPA
    // ═══════════════════════════════════════════════════
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageW, pageH, 'F');

    // Logo text "bwild"
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246); // blue-500
    doc.text('bwild', pageW / 2, 80, { align: 'center' });

    // Subtitle
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('AGÊNCIA DE PERFORMANCE', pageW / 2, 90, { align: 'center' });

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Relatório de Performance', pageW / 2, 130, { align: 'center' });
    doc.setFontSize(18);
    doc.text('Meta Ads', pageW / 2, 142, { align: 'center' });

    // Divider
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(pageW / 2 - 30, 152, pageW / 2 + 30, 152);

    // Period
    doc.setFontSize(12);
    doc.setTextColor(203, 213, 225); // slate-300
    doc.text(report.periodLabel, pageW / 2, 165, { align: 'center' });
    if (report.compLabel) {
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(`vs ${report.compLabel}`, pageW / 2, 173, { align: 'center' });
    }

    // Generation date
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    const genDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`Gerado em ${genDate}`, pageW / 2, 200, { align: 'center' });

    // ═══════════════════════════════════════════════════
    // PAGE 2: Resumo Executivo
    // ═══════════════════════════════════════════════════
    doc.addPage();
    y = 20;

    const sectionTitle = (title: string, color: [number, number, number] = [59, 130, 246]) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(title, 14, y);
      y += 2;
      doc.setDrawColor(...color);
      doc.setLineWidth(0.3);
      doc.line(14, y, 80, y);
      y += 6;
    };

    const bodyText = (text: string, maxW = 180) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(text, maxW);
      if (y + lines.length * 5 > 275) { doc.addPage(); y = 20; }
      doc.text(lines, 14, y);
      y += lines.length * 5 + 4;
    };

    sectionTitle('1. Resumo Executivo');
    if (aiNarrative?.resumo_executivo) {
      bodyText(aiNarrative.resumo_executivo);
    } else {
      bodyText(report.summary);
    }

    // ═══════════════════════════════════════════════════
    // 2. KPIs Principais
    // ═══════════════════════════════════════════════════
    sectionTitle('2. KPIs Principais');

    const kpiData = METRIC_DEFS.slice(0, 12).map(def => {
      const val = (report.cm as any)[def.key] ?? 0;
      const prevVal = report.pm ? (report.pm as any)[def.key] ?? 0 : null;
      const delta = prevVal !== null && prevVal !== 0
        ? `${(((val - prevVal) / Math.abs(prevVal)) * 100).toFixed(1)}%`
        : '—';
      const benchmarks = VERTICALS[DEFAULT_VERTICAL];
      const status = getBenchmarkStatus(def.key, val, benchmarks);
      const statusEmoji = status === 'good' ? '🟢' : status === 'warning' ? '🟡' : status === 'bad' ? '🔴' : '⚪';
      return [def.label, def.format(val), prevVal !== null ? def.format(prevVal) : '—', delta, statusEmoji];
    });

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Atual', 'Anterior', 'Δ %', 'Status']],
      body: kpiData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // ═══════════════════════════════════════════════════
    // 3. O que mudou
    // ═══════════════════════════════════════════════════
    sectionTitle('3. O que mudou');
    if (aiNarrative?.o_que_mudou) {
      bodyText(aiNarrative.o_que_mudou);
    } else if (report.explanations.length > 0) {
      report.explanations.forEach(exp => {
        bodyText(exp.narrative);
      });
    } else {
      bodyText('Sem variações significativas no período.');
    }

    // ═══════════════════════════════════════════════════
    // 4. Por quê
    // ═══════════════════════════════════════════════════
    sectionTitle('4. Por quê', [245, 158, 11]);
    if (aiNarrative?.por_que) {
      bodyText(aiNarrative.por_que);
    } else {
      bodyText('Análise de drivers não disponível. Gere a narrativa com IA para obter esta seção.');
    }

    // ═══════════════════════════════════════════════════
    // 5. Top 5 Campanhas
    // ═══════════════════════════════════════════════════
    sectionTitle('5. Top 5 Campanhas');

    if (report.top5.length > 0) {
      const top5Data = report.top5.map(c => [
        c.name.length > 35 ? c.name.slice(0, 35) + '…' : c.name,
        `R$${c.spend.toFixed(2)}`,
        `${c.results}`,
        `R$${c.cpa.toFixed(2)}`,
        `${c.ctr.toFixed(2)}%`,
        c.status === 'active' ? '🟢 Ativo' : '⚪ Inativo',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Campanha', 'Investimento', 'Resultados', 'CPA', 'CTR', 'Status']],
        body: top5Data,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ═══════════════════════════════════════════════════
    // 6. Criativos em Destaque
    // ═══════════════════════════════════════════════════
    sectionTitle('6. Criativos em Destaque', [16, 185, 129]);

    if (report.topAds.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text('Top 3 — Melhor Performance', 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [['Anúncio', 'CTR', 'CPA', 'Invest.', 'Result.']],
        body: report.topAds.map(a => [
          a.name.length > 40 ? a.name.slice(0, 40) + '…' : a.name,
          `${a.ctr.toFixed(2)}%`,
          `R$${a.cpa.toFixed(2)}`,
          `R$${a.spend.toFixed(2)}`,
          `${a.results}`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    if (report.bottomAds.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68);
      doc.text('Bottom 3 — Pior Performance', 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [['Anúncio', 'CTR', 'CPA', 'Invest.', 'Result.']],
        body: report.bottomAds.map(a => [
          a.name.length > 40 ? a.name.slice(0, 40) + '…' : a.name,
          `${a.ctr.toFixed(2)}%`,
          `R$${a.cpa.toFixed(2)}`,
          `R$${a.spend.toFixed(2)}`,
          `${a.results}`,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ═══════════════════════════════════════════════════
    // 7. Alertas do Período
    // ═══════════════════════════════════════════════════
    sectionTitle('7. Alertas do Período', [239, 68, 68]);

    if (report.highlights.negative.length > 0 || report.highlights.positive.length > 0) {
      const alertData = [
        ...report.highlights.negative.map(h => ['🔴', h, 'Atenção']),
        ...report.highlights.positive.map(h => ['🟢', h, 'OK']),
      ];

      autoTable(doc, {
        startY: y,
        head: [['', 'Alerta', 'Status']],
        body: alertData,
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 20 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    } else {
      bodyText('Nenhum alerta registrado no período.');
    }

    // ═══════════════════════════════════════════════════
    // 8. O que faremos
    // ═══════════════════════════════════════════════════
    sectionTitle('8. O que faremos', [16, 185, 129]);
    if (aiNarrative?.o_que_faremos) {
      bodyText(aiNarrative.o_que_faremos);
    } else if (report.autoRecs.length > 0) {
      report.autoRecs.forEach((rec, i) => {
        bodyText(`${i + 1}. ${rec.title}\n   Por quê: ${rec.why}\n   Ação: ${rec.what_to_do}`);
      });
    } else {
      report.recommendations.forEach((r, i) => {
        bodyText(`${i + 1}. ${r}`);
      });
    }

    // ═══════════════════════════════════════════════════
    // 9. Semáforo por Campanha (Log de Decisões)
    // ═══════════════════════════════════════════════════
    if (report.verdicts.length > 0) {
      sectionTitle('9. Log de Decisões — Semáforo');

      const verdictData = report.verdicts.map(v => [
        `${v.verdict.emoji} ${v.verdict.label}`,
        v.name.length > 30 ? v.name.slice(0, 30) + '…' : v.name,
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
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ═══════════════════════════════════════════════════
    // Footer on every page
    // ═══════════════════════════════════════════════════
    const totalPages = doc.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`bwild — Relatório de Performance Meta Ads`, 14, pageH - 8);
      doc.text(`Página ${i - 1} de ${totalPages - 1}`, pageW - 14, pageH - 8, { align: 'right' });
    }

    const dateSlug = `${state.dateFrom || 'inicio'}-${state.dateTo || 'fim'}`;
    doc.save(`relatorio-bwild-${dateSlug}.pdf`);
    toast.success('PDF gerado com sucesso!');
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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generateAINarrative} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {isGenerating ? 'Claude está analisando...' : aiNarrative ? 'Regerar Narrativa IA' : 'Gerar Narrativa IA'}
          </Button>
          <Button size="sm" onClick={exportPDF}>
            <Download className="h-4 w-4 mr-1" /> Gerar Relatório PDF
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isGenerating && (
        <div className="glass-card p-6 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Claude está analisando seus dados...</p>
          <p className="text-xs text-muted-foreground/60">Gerando resumo executivo, análise de variações e recomendações</p>
        </div>
      )}

      {/* Resumo Executivo */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wider">1. Resumo Executivo</h3>
        {aiNarrative?.resumo_executivo ? (
          <div className="space-y-2">
            <p className="text-foreground leading-relaxed">{aiNarrative.resumo_executivo}</p>
            <Badge variant="outline" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" />Gerado por IA</Badge>
          </div>
        ) : (
          <p className="text-foreground leading-relaxed">{report.summary}</p>
        )}
      </div>

      {/* ─── AI NARRATIVE SECTIONS ─── */}
      {aiNarrative && (
        <div className="space-y-4">
          {[
            { num: '3', title: 'O que mudou', content: aiNarrative.o_que_mudou, icon: <MessageSquare className="h-4 w-4" />, borderColor: 'border-l-primary/50', titleColor: 'text-primary' },
            { num: '4', title: 'Por quê', content: aiNarrative.por_que, icon: <Lightbulb className="h-4 w-4" />, borderColor: 'border-l-amber-500/50', titleColor: 'text-amber-400' },
            { num: '8', title: 'O que faremos', content: aiNarrative.o_que_faremos, icon: <CheckCircle2 className="h-4 w-4" />, borderColor: 'border-l-emerald-500/50', titleColor: 'text-emerald-400' },
          ].map((section, idx) => (
            <div key={idx} className={`glass-card p-5 border-l-2 ${section.borderColor}`}>
              <h3 className={`text-sm font-medium ${section.titleColor} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                {section.icon} {section.num}. {section.title}
                <Badge variant="outline" className="text-[10px] ml-auto"><Sparkles className="h-3 w-3 mr-1" />IA</Badge>
              </h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{section.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── RULE-BASED: O QUE MUDOU (show when no AI) ─── */}
      {!aiNarrative && report.explanations.length > 0 && (
        <div className="glass-card p-5 border-l-2 border-l-primary/50">
          <h3 className="text-sm font-medium text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> 3. O que mudou
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

      {/* ─── RULE-BASED: O QUE FAREMOS (show when no AI) ─── */}
      {!aiNarrative && report.autoRecs.length > 0 && (
        <div className="glass-card p-5 border-l-2 border-l-amber-500/50">
          <h3 className="text-sm font-medium text-amber-400 mb-4 uppercase tracking-wider flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> 8. O que faremos
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
          <h3 className="text-sm font-medium text-foreground mb-3 uppercase tracking-wider">9. Semáforo por Campanha</h3>
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
