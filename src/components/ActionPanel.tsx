import { useMemo, useState } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  groupByLevel,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/calculations';
import { computeVerdict } from '@/lib/insights/verdicts';
import type { GroupedRow } from '@/lib/calculations';
import type { AggregatedMetrics } from '@/lib/types';
import { Zap, ArrowUp, Pause, RefreshCw, Eye, Scale, ChevronDown, ChevronUp } from 'lucide-react';

interface ActionItem {
  icon: React.ReactNode;
  action: string;
  target: string;
  reason: string;
  guidance: string; // detailed "what to do"
  metrics: string[]; // supporting metric lines
  priority: 'high' | 'medium' | 'low';
}

function generateGuidance(
  row: GroupedRow,
  avg: AggregatedMetrics,
  verdict: string
): { guidance: string; metrics: string[] } {
  const m = row.metrics;
  const metrics: string[] = [];
  const tips: string[] = [];

  const cpaRatio = avg.cost_per_result > 0 ? m.cost_per_result / avg.cost_per_result : 1;
  const ctrOk = m.ctr_link >= 1.2;
  const ctrLow = m.ctr_link < 1.0;
  const lpvRateLow = m.lpv_rate < 0.5;
  const lpvRateOk = m.lpv_rate >= 0.6;
  const cvrLPLow = m.result_per_lpv < 0.05;
  const freqHigh = m.frequency > 3;

  // Always show key metrics
  if (m.spend_brl > 0) metrics.push(`Investimento: ${formatCurrency(m.spend_brl)}`);
  if (m.ctr_link > 0) metrics.push(`CTR Link: ${m.ctr_link.toFixed(2)}%`);
  if (m.cpm > 0) metrics.push(`CPM: ${formatCurrency(m.cpm)}`);
  if (m.lpv_rate > 0) metrics.push(`LPV Rate: ${(m.lpv_rate * 100).toFixed(0)}%`);
  if (m.cost_per_result > 0) metrics.push(`CPA: ${formatCurrency(m.cost_per_result)}`);
  if (m.frequency > 0) metrics.push(`Frequência: ${m.frequency.toFixed(1)}`);
  if (m.result_per_lpv > 0) metrics.push(`CVR LP: ${(m.result_per_lpv * 100).toFixed(1)}%`);

  if (verdict === 'scale') {
    tips.push('Aumentar budget 20-30% por semana (não brusco para não reiniciar aprendizado).');
    if (m.frequency < 2) tips.push('Frequência baixa — audiência ainda não saturada, bom sinal para escalar.');
    if (ctrOk && lpvRateOk) tips.push('Criativo e LP estão alinhados — manter sem mexer enquanto escala.');
  } else if (verdict === 'pause') {
    if (cpaRatio > 1.5) tips.push(`CPA ${((cpaRatio - 1) * 100).toFixed(0)}% acima da média — drenando budget sem retorno.`);
    if (ctrLow && m.cpm > 30) tips.push('CPM alto + CTR baixo = hook fraco. Se reativar, trocar criativo completamente.');
    if (ctrOk && cvrLPLow) tips.push('CTR ok mas LP não converte — se reativar, mudar a landing page primeiro.');
    if (freqHigh) tips.push(`Frequência ${m.frequency.toFixed(1)} — audiência saturada. Se reativar, usar público novo.`);
    if (tips.length === 0) tips.push('Performance consistentemente abaixo da média. Pausar e realocar budget para itens com Score alto.');
  } else if (verdict === 'test_variation') {
    if (ctrLow) tips.push('CTR fraco — testar novo hook: formato 9:16, demonstração nos primeiros 3s, CTA mais direto.');
    if (ctrOk && lpvRateLow) tips.push('Criativo funciona mas cliques se perdem antes da LP. Verificar velocidade e redirecionamentos.');
    if (ctrOk && cvrLPLow) tips.push('Criativo bom, LP fraca — testar nova headline, reduzir campos do formulário, adicionar prova social.');
    if (freqHigh) tips.push('Frequência alta — duplicar o conjunto com criativo novo para o mesmo público.');
    if (tips.length === 0) tips.push('Potencial de melhoria detectado. Criar variação de criativo ou testar novo público.');
  } else if (verdict === 'watch') {
    if (cpaRatio > 1.3) tips.push(`CPA ${((cpaRatio - 1) * 100).toFixed(0)}% acima da média — monitorar por mais 3 dias antes de agir.`);
    if (ctrLow) tips.push('CTR abaixo de 1% — se não melhorar em 48h, pausar e trocar criativo.');
    if (lpvRateLow) tips.push('LPV Rate baixo — verificar se a LP carrega corretamente no mobile.');
    if (m.results < 5) tips.push('Volume baixo de resultados — dados insuficientes para decisão. Aguardar acumular.');
    if (tips.length === 0) tips.push('Resultados medianos. Aguardar mais dados antes de decidir entre escalar ou pausar.');
  } else {
    tips.push('Performance estável. Manter e monitorar semanalmente.');
  }

  return { guidance: tips.join(' '), metrics };
}

export default function ActionPanel() {
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const actions = useMemo((): ActionItem[] => {
    if (current.length === 0) return [];
    const avgMetrics = aggregateMetrics(current);
    const rows = groupByLevel(current, previous, state.analysisLevel, '', false);
    const items: ActionItem[] = [];

    for (const row of rows) {
      const v = computeVerdict(row, avgMetrics);
      const { guidance, metrics } = generateGuidance(row, avgMetrics, v.verdict);

      const iconMap: Record<string, React.ReactNode> = {
        scale: <ArrowUp className="h-4 w-4" />,
        pause: <Pause className="h-4 w-4" />,
        test_variation: <RefreshCw className="h-4 w-4" />,
        watch: <Eye className="h-4 w-4" />,
        keep: <Eye className="h-4 w-4" />,
      };
      const actionMap: Record<string, string> = {
        scale: 'Escalar',
        pause: 'Pausar',
        test_variation: 'Testar variação',
        watch: 'Observar',
        keep: 'Manter',
      };
      const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
        scale: 'high',
        pause: 'high',
        test_variation: 'medium',
        watch: 'low',
        keep: 'low',
      };

      if (v.verdict !== 'keep') {
        items.push({
          icon: iconMap[v.verdict],
          action: actionMap[v.verdict],
          target: row.name,
          reason: `Score ${v.score} — ${v.reasons[0] || 'Análise de performance'}`,
          guidance,
          metrics,
          priority: priorityMap[v.verdict],
        });
      }
    }

    const scalable = rows.filter(r => computeVerdict(r, avgMetrics).verdict === 'scale');
    const pausable = rows.filter(r => computeVerdict(r, avgMetrics).verdict === 'pause');
    if (scalable.length > 0 && pausable.length > 0) {
      const savedBudget = pausable.reduce((s, r) => s + r.metrics.spend_brl, 0);
      items.unshift({
        icon: <Scale className="h-4 w-4" />,
        action: 'Realocar budget',
        target: `${formatCurrency(savedBudget)} de ${pausable.length} item(ns) para ${scalable.length} item(ns)`,
        reason: `Mover budget de itens com Score baixo para itens com Score alto`,
        guidance: `Pausar os ${pausable.length} item(ns) com pior performance e redistribuir R$${savedBudget.toFixed(0)} para "${scalable[0]?.name || 'melhor item'}" e similares. Aumentar gradualmente (20-30%/semana).`,
        metrics: [
          `Budget liberável: ${formatCurrency(savedBudget)}`,
          `Itens para pausar: ${pausable.map(r => r.name).slice(0, 3).join(', ')}`,
          `Itens para escalar: ${scalable.map(r => r.name).slice(0, 3).join(', ')}`,
        ],
        priority: 'high',
      });
    }

    return items;
  }, [current, previous, state.analysisLevel]);

  if (actions.length === 0) return null;

  const priorityColors = {
    high: 'border-l-negative',
    medium: 'border-l-warning',
    low: 'border-l-muted-foreground',
  };

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-warning" />
        O que fazer agora? ({actions.length} ações)
      </h3>
      <div className="space-y-2">
        {actions.map((a, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <div
              key={i}
              className={`rounded-lg bg-secondary/30 border-l-4 ${priorityColors[a.priority]} transition-all`}
            >
              <button
                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="flex items-start gap-3 p-3 w-full text-left hover:bg-secondary/50 transition-colors rounded-lg"
              >
                <span className={`flex-shrink-0 mt-0.5 ${a.priority === 'high' ? 'text-negative' : a.priority === 'medium' ? 'text-warning' : 'text-muted-foreground'}`}>
                  {a.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {a.action}: <span className="font-normal text-foreground/80">{a.target}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{a.reason}</p>
                </div>
                <span className="flex-shrink-0 text-muted-foreground mt-0.5">
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </span>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 ml-10 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {/* Metrics pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {a.metrics.map((m, j) => (
                      <span
                        key={j}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2/80 text-muted-foreground border border-border/50"
                      >
                        {m}
                      </span>
                    ))}
                  </div>

                  {/* Guidance */}
                  <div className="bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                    <p className="text-[11px] font-medium text-primary mb-1">💡 O que fazer:</p>
                    <p className="text-[11px] text-foreground/80 leading-relaxed">{a.guidance}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
