import { useMemo, useState, useCallback } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { aggregateMetrics, formatCurrency, formatNumber, formatPercent, computeFunnel } from '@/lib/calculations';
import { Calculator, Sparkles, Loader2, Save, Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type Scenario = {
  nome: string;
  investimento: number;
  roas: number;
  cpa: number;
  conversoes: number;
  receita: number;
};

type ClaudeAnalysis = {
  cenario_recomendado: string;
  justificativa: string;
  riscos: string;
  o_que_monitorar: string[];
  alerta?: string;
};

type SavedSimulation = {
  id: string;
  created_at: string;
  budget_atual: number;
  budget_simulado: number;
  periodo_dias: number;
  objetivo: string;
  cenario_recomendado: string | null;
  cenarios_json: any;
  analise_claude_json: any;
};

export default function BudgetSimulator() {
  const { state } = useAppState();
  const { current } = useFilteredRecords();

  // Inputs
  const [budgetSimulado, setBudgetSimulado] = useState<string>('');
  const [periodoDias, setPeriodoDias] = useState<string>('30');
  const [objetivo, setObjetivo] = useState<string>('roas');
  const [valorObjetivo, setValorObjetivo] = useState<string>('');

  // Results
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [claudeAnalysis, setClaudeAnalysis] = useState<ClaudeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [savedSims, setSavedSims] = useState<SavedSimulation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Historical metrics
  const historico = useMemo(() => {
    if (current.length === 0) return null;
    const m = aggregateMetrics(current);
    const funnel = state.funnelData.find(f => f.period_key === state.dateFrom);
    const funnelComputed = funnel ? computeFunnel(funnel, m) : null;
    const roas = funnelComputed?.roas || (m.results > 0 && m.spend_brl > 0 ? m.results / m.spend_brl : 0);
    const ticketMedio = funnelComputed?.ticket_medio || (roas > 0 ? m.cost_per_result * roas : 0);

    return {
      investimento: m.spend_brl,
      roas: +roas.toFixed(2),
      cpa: +m.cost_per_result.toFixed(2),
      ctr: +m.ctr_link.toFixed(2),
      cpm: +m.cpm.toFixed(2),
      conversoes: m.results,
      impressoes: m.impressions,
      ticketMedio: +ticketMedio.toFixed(2),
      frequencia: +m.frequency.toFixed(2),
    };
  }, [current, state.funnelData, state.dateFrom]);

  // Set default budget
  useMemo(() => {
    if (historico && !budgetSimulado) {
      setBudgetSimulado(historico.investimento.toFixed(0));
    }
  }, [historico]);

  const runSimulation = useCallback(() => {
    if (!historico) return;
    setIsSimulating(true);

    const budget = parseFloat(budgetSimulado) || historico.investimento;
    const dias = parseInt(periodoDias);
    const scaleFactor = dias / 30;

    const baseRoas = historico.roas;
    const baseCpa = historico.cpa;
    const ticket = historico.ticketMedio || (baseCpa * baseRoas) || baseCpa;

    // Conservador: 80% do budget atual
    const consInvest = historico.investimento * 0.8 * scaleFactor;
    const consRoas = baseRoas * 0.90;
    const consCpa = baseCpa * 1.10;
    const consConv = consCpa > 0 ? consInvest / consCpa : 0;
    const consReceita = consConv * ticket;

    // Realista: budget do usuário
    const realInvest = budget * scaleFactor;
    const realRoas = baseRoas * 0.95;
    const realCpa = baseCpa * 1.05;
    const realConv = realCpa > 0 ? realInvest / realCpa : 0;
    const realReceita = realConv * ticket;

    // Agressivo: 150% do budget atual
    const agrInvest = historico.investimento * 1.5 * scaleFactor;
    const agrRoas = baseRoas * 0.80;
    const agrCpa = baseCpa * 1.25;
    const agrConv = agrCpa > 0 ? agrInvest / agrCpa : 0;
    const agrReceita = agrConv * ticket;

    const results: Scenario[] = [
      { nome: 'Conservador', investimento: consInvest, roas: consRoas, cpa: consCpa, conversoes: consConv, receita: consReceita },
      { nome: 'Realista', investimento: realInvest, roas: realRoas, cpa: realCpa, conversoes: realConv, receita: realReceita },
      { nome: 'Agressivo', investimento: agrInvest, roas: agrRoas, cpa: agrCpa, conversoes: agrConv, receita: agrReceita },
    ];

    setScenarios(results);
    setClaudeAnalysis(null);
    setIsSimulating(false);
  }, [historico, budgetSimulado, periodoDias]);

  const askClaude = useCallback(async () => {
    if (!scenarios || !historico) return;
    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('simulate-budget-analysis', {
        body: {
          objetivo,
          valorObjetivo: valorObjetivo || 'não definido',
          periodoDias: parseInt(periodoDias),
          historico: {
            roas: historico.roas,
            cpa: historico.cpa,
            conversoes: historico.conversoes,
            investimento: historico.investimento,
            ctr: historico.ctr,
            cpm: historico.cpm,
          },
          cenarios: scenarios.map(s => ({
            nome: s.nome,
            investimento: s.investimento.toFixed(2),
            roas_projetado: s.roas.toFixed(2),
            cpa_projetado: s.cpa.toFixed(2),
            conversoes_projetadas: Math.round(s.conversoes),
            receita_estimada: s.receita.toFixed(2),
          })),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setClaudeAnalysis(data as ClaudeAnalysis);
      toast.success('Análise do Claude gerada!');
    } catch (err: any) {
      console.error('Claude analysis error:', err);
      toast.error(err.message || 'Erro ao gerar análise');
    } finally {
      setIsAnalyzing(false);
    }
  }, [scenarios, historico, objetivo, valorObjetivo, periodoDias]);

  const saveSimulation = useCallback(async () => {
    if (!scenarios || !historico) return;
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get workspace from memberships
      const { data: memberships } = await supabase
        .from('workspace_memberships')
        .select('workspace_id')
        .limit(1);
      
      const wId = memberships?.[0]?.workspace_id;
      if (!wId) throw new Error('Nenhum workspace encontrado');

      const { error } = await supabase.from('budget_simulations').insert({
        workspace_id: wId,
        user_id: user?.id,
        budget_atual: historico.investimento,
        budget_simulado: parseFloat(budgetSimulado) || historico.investimento,
        periodo_dias: parseInt(periodoDias),
        objetivo,
        valor_objetivo: parseFloat(valorObjetivo) || null,
        cenarios_json: scenarios,
        cenario_recomendado: claudeAnalysis?.cenario_recomendado || null,
        analise_claude_json: claudeAnalysis || null,
        metricas_historicas_json: historico,
      } as any);

      if (error) throw error;
      toast.success('Simulação salva!');
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  }, [scenarios, historico, claudeAnalysis, budgetSimulado, periodoDias, objetivo, valorObjetivo, state.records]);

  const exportPDF = useCallback(() => {
    if (!scenarios || !historico) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('bwild — Simulação de Budget', 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${periodoDias} dias | Objetivo: ${objetivo.toUpperCase()} ${valorObjetivo ? `de ${valorObjetivo}` : ''}`, 14, y);
    y += 5;
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, y);
    y += 10;

    // Historical
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.text('Métricas Históricas (base)', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Valor']],
      body: [
        ['Investimento', `R$ ${historico.investimento.toFixed(2)}`],
        ['ROAS', `${historico.roas}x`],
        ['CPA', `R$ ${historico.cpa}`],
        ['Conversões', `${historico.conversoes}`],
        ['CTR', `${historico.ctr}%`],
        ['CPM', `R$ ${historico.cpm}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Scenarios table
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Cenários Simulados', 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [['Métrica', 'Conservador', 'Realista', 'Agressivo']],
      body: [
        ['Investimento', ...scenarios.map(s => `R$ ${s.investimento.toFixed(2)}`)],
        ['ROAS projetado', ...scenarios.map(s => `${s.roas.toFixed(2)}x`)],
        ['CPA projetado', ...scenarios.map(s => `R$ ${s.cpa.toFixed(2)}`)],
        ['Conversões', ...scenarios.map(s => `${Math.round(s.conversoes)}`)],
        ['Receita est.', ...scenarios.map(s => `R$ ${s.receita.toFixed(2)}`)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Claude analysis
    if (claudeAnalysis) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(59, 130, 246);
      doc.text('Análise do Claude', 14, y);
      y += 7;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30);
      doc.text(`Cenário recomendado: ${claudeAnalysis.cenario_recomendado}`, 14, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const justLines = doc.splitTextToSize(`Justificativa: ${claudeAnalysis.justificativa}`, 180);
      doc.text(justLines, 14, y);
      y += justLines.length * 4 + 4;

      const riskLines = doc.splitTextToSize(`Riscos: ${claudeAnalysis.riscos}`, 180);
      doc.text(riskLines, 14, y);
      y += riskLines.length * 4 + 4;

      doc.text('O que monitorar:', 14, y);
      y += 5;
      claudeAnalysis.o_que_monitorar.forEach(item => {
        doc.text(`• ${item}`, 18, y);
        y += 4;
      });

      if (claudeAnalysis.alerta) {
        y += 3;
        doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        const alertLines = doc.splitTextToSize(`⚠️ ALERTA: ${claudeAnalysis.alerta}`, 180);
        doc.text(alertLines, 14, y);
      }
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text('bwild — Simulação de Budget', 14, doc.internal.pageSize.getHeight() - 8);
      doc.text(`Página ${i} de ${totalPages}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }

    doc.save(`simulacao-bwild-${periodoDias}dias-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF exportado!');
  }, [scenarios, historico, claudeAnalysis, periodoDias, objetivo, valorObjetivo]);

  // Chart data for projections
  const chartData = useMemo(() => {
    if (!scenarios) return [];
    const dias = parseInt(periodoDias);
    const points: any[] = [];
    for (let d = 1; d <= Math.min(dias, 30); d++) {
      const fraction = d / dias;
      points.push({
        dia: `D${d}`,
        'Conservador (Conv.)': Math.round(scenarios[0].conversoes * fraction),
        'Realista (Conv.)': Math.round(scenarios[1].conversoes * fraction),
        'Agressivo (Conv.)': Math.round(scenarios[2].conversoes * fraction),
      });
    }
    return points;
  }, [scenarios, periodoDias]);

  if (!historico) {
    return (
      <div className="glass-card p-8 text-center">
        <Calculator className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Selecione um período com dados para usar o simulador</p>
      </div>
    );
  }

  const recommendedLabel = claudeAnalysis?.cenario_recomendado;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Simulador de Budget
        </h2>
        <div className="flex gap-2">
          {scenarios && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowHistory(!showHistory)}>
                <History className="h-4 w-4 mr-1" /> Histórico
              </Button>
              <Button size="sm" variant="outline" onClick={saveSimulation} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={exportPDF}>
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ PAINEL DE ENTRADA ═══ */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Parâmetros</h3>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Budget Atual (período)</Label>
              <div className="p-2.5 rounded-lg bg-secondary/30 text-sm font-medium text-foreground">
                {formatCurrency(historico.investimento)}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Budget Simulado (R$)</Label>
              <Input
                type="number"
                value={budgetSimulado}
                onChange={e => setBudgetSimulado(e.target.value)}
                placeholder="Ex: 10000"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Período de Projeção</Label>
              <Select value={periodoDias} onValueChange={setPeriodoDias}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Objetivo Principal</Label>
              <Select value={objetivo} onValueChange={setObjetivo}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roas">ROAS</SelectItem>
                  <SelectItem value="cpa">CPA</SelectItem>
                  <SelectItem value="conversoes">Conversões</SelectItem>
                  <SelectItem value="alcance">Alcance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Valor Objetivo (opcional)</Label>
              <Input
                type="number"
                value={valorObjetivo}
                onChange={e => setValorObjetivo(e.target.value)}
                placeholder={objetivo === 'roas' ? 'Ex: 4' : objetivo === 'cpa' ? 'Ex: 25' : 'Ex: 500'}
                className="text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={runSimulation} disabled={isSimulating} className="flex-1">
                {isSimulating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calculator className="h-4 w-4 mr-1" />}
                Simular
              </Button>
              {scenarios && (
                <Button onClick={askClaude} disabled={isAnalyzing} variant="outline" className="flex-1">
                  {isAnalyzing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  {isAnalyzing ? 'Analisando...' : 'Claude'}
                </Button>
              )}
            </div>
          </div>

          {/* Métricas Históricas */}
          <div className="glass-card p-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico Base</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'ROAS', value: `${historico.roas}x` },
                { label: 'CPA', value: formatCurrency(historico.cpa) },
                { label: 'CTR', value: `${historico.ctr}%` },
                { label: 'CPM', value: formatCurrency(historico.cpm) },
                { label: 'Conv.', value: formatNumber(historico.conversoes) },
                { label: 'Freq.', value: historico.frequencia.toString() },
              ].map(item => (
                <div key={item.label} className="text-center p-2 rounded-md bg-secondary/20">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="text-xs font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ PAINEL DE RESULTADOS ═══ */}
        <div className="lg:col-span-2 space-y-4">
          {!scenarios ? (
            <div className="glass-card p-12 text-center">
              <Calculator className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Configure os parâmetros e clique em "Simular"</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Os cenários serão calculados com base nos dados históricos reais</p>
            </div>
          ) : (
            <>
              {/* Claude recommendation badge */}
              {claudeAnalysis && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    Claude recomenda o cenário <span className="text-primary font-bold capitalize">{claudeAnalysis.cenario_recomendado}</span>
                  </span>
                  <Badge variant="outline" className="text-[10px] ml-auto"><Sparkles className="h-3 w-3 mr-1" />IA</Badge>
                </div>
              )}

              {/* Loading */}
              {isAnalyzing && (
                <div className="glass-card p-6 text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-sm text-muted-foreground">Claude está analisando seus cenários...</p>
                </div>
              )}

              {/* 3 Scenarios side by side */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {scenarios.map((s, idx) => {
                  const isRecommended = recommendedLabel === s.nome.toLowerCase();
                  const colors = [
                    { border: 'border-blue-500/30', bg: 'bg-blue-500/5', text: 'text-blue-400' },
                    { border: 'border-primary/30', bg: 'bg-primary/5', text: 'text-primary' },
                    { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-400' },
                  ];
                  const c = colors[idx];

                  return (
                    <div key={s.nome} className={`glass-card p-4 border ${isRecommended ? 'border-primary ring-1 ring-primary/30' : c.border} ${c.bg} relative`}>
                      {isRecommended && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground text-[10px]">
                            ✅ Recomendado
                          </Badge>
                        </div>
                      )}
                      <h4 className={`text-sm font-bold ${c.text} text-center mb-3 ${isRecommended ? 'mt-1' : ''}`}>{s.nome}</h4>
                      <div className="space-y-2">
                        {[
                          { label: 'Investimento', value: formatCurrency(s.investimento) },
                          { label: 'ROAS projetado', value: `${s.roas.toFixed(2)}x` },
                          { label: 'CPA projetado', value: formatCurrency(s.cpa) },
                          { label: 'Conversões', value: formatNumber(Math.round(s.conversoes)) },
                          { label: 'Receita est.', value: formatCurrency(s.receita) },
                        ].map(item => (
                          <div key={item.label} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-medium text-foreground">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Projection Chart */}
              {chartData.length > 0 && (
                <div className="glass-card p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Projeção de Conversões ({periodoDias} dias)
                  </h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Line type="monotone" dataKey="Conservador (Conv.)" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Realista (Conv.)" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Agressivo (Conv.)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Claude Analysis */}
              {claudeAnalysis && (
                <div className="glass-card p-5 border-l-2 border-l-primary/50">
                  <button
                    onClick={() => setShowAnalysis(!showAnalysis)}
                    className="w-full flex items-center justify-between mb-3"
                  >
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Análise do Claude
                    </h4>
                    {showAnalysis ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {showAnalysis && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Justificativa</p>
                        <p className="text-sm text-foreground leading-relaxed">{claudeAnalysis.justificativa}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 text-amber-400" /> Riscos
                        </p>
                        <p className="text-sm text-foreground leading-relaxed">{claudeAnalysis.riscos}</p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">O que monitorar</p>
                        <ul className="space-y-1.5">
                          {claudeAnalysis.o_que_monitorar.map((item, i) => (
                            <li key={i} className="text-xs text-foreground flex items-start gap-2">
                              <TrendingUp className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {claudeAnalysis.alerta && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <p className="text-xs font-semibold text-destructive flex items-center gap-1 mb-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Alerta Crítico
                          </p>
                          <p className="text-sm text-foreground">{claudeAnalysis.alerta}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
