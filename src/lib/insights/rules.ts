import type { AggregatedMetrics, DeltaMetrics, LeadQualityMetrics, CreativeLifecycleRecord } from '../types';
import { CREATIVE_LIFESPAN } from '../types';
import type { GroupedRow } from '../calculations';
import type { InsightCard } from './types';
import { THRESHOLDS } from './thresholds';
import { computeConfidence } from './score';

// I1: CTR engana — high CTR but low LPV rate
function checkCTRDeception(metrics: AggregatedMetrics): InsightCard | null {
  if (metrics.ctr_link >= 1.0 && metrics.lpv_rate < THRESHOLDS.lpv_rate_low && metrics.link_clicks > 50) {
    return {
      id: 'i1-ctr-deception',
      title: 'CTR alto, mas clique não converte',
      description: `CTR Link de ${metrics.ctr_link.toFixed(2)}% parece bom, mas apenas ${(metrics.lpv_rate * 100).toFixed(0)}% dos cliques chegam à landing page.`,
      evidence: `LPV Rate: ${(metrics.lpv_rate * 100).toFixed(1)}% (abaixo de ${(THRESHOLDS.lpv_rate_low * 100).toFixed(0)}%)`,
      action: 'Verificar se o anúncio está desalinhado com a landing page ou se há cliques acidentais.',
      severity: 'high',
      category: 'post_click',
      confidence: computeConfidence(2, 0.9),
    };
  }
  return null;
}

// I2: Triângulo sagrado — CPM/CTR/CostResult diagnosis
function checkSacredTriangle(metrics: AggregatedMetrics, delta: DeltaMetrics): InsightCard | null {
  if (!delta.previous) return null;
  const cpmC = delta.deltas['cpm']?.percent;
  const ctrC = delta.deltas['ctr_link']?.percent;
  const cpaC = delta.deltas['cost_per_result']?.percent;
  const lpvC = delta.deltas['lpv_rate']?.percent;
  if (cpmC === null || ctrC === null) return null;

  if (cpmC > 10 && Math.abs(ctrC) < 5 && cpaC && cpaC > 10) {
    return {
      id: 'i2-auction', title: 'Pressão de leilão detectada',
      description: `CPM subiu ${cpmC.toFixed(0)}% enquanto CTR ficou estável. CPA subiu ${cpaC.toFixed(0)}%.`,
      evidence: `CPM: +${cpmC.toFixed(1)}%, CTR: ${ctrC > 0 ? '+' : ''}${ctrC.toFixed(1)}%`,
      action: 'Diversificar posicionamentos, testar novos públicos ou ajustar lances.',
      severity: 'high', category: 'auction', confidence: computeConfidence(3, 0.85),
    };
  }
  if (ctrC < -10 && Math.abs(cpmC) < 10) {
    return {
      id: 'i2-creative', title: 'Criativo perdendo eficácia',
      description: `CTR caiu ${Math.abs(ctrC).toFixed(0)}% enquanto CPM se manteve estável.`,
      evidence: `CTR: ${ctrC.toFixed(1)}%, CPM: ${cpmC > 0 ? '+' : ''}${cpmC.toFixed(1)}%`,
      action: 'Renovar criativos e testar novas abordagens de copy.',
      severity: 'medium', category: 'creative', confidence: computeConfidence(2, 0.8),
    };
  }
  if (Math.abs(ctrC) < 5 && lpvC && lpvC < -10 && cpaC && cpaC > 10) {
    return {
      id: 'i2-postclick', title: 'Problema pós-clique identificado',
      description: `CTR estável mas LPV Rate caiu ${Math.abs(lpvC).toFixed(0)}% e CPA subiu ${cpaC.toFixed(0)}%.`,
      evidence: `LPV Rate: ${lpvC.toFixed(1)}%, CPA: +${cpaC.toFixed(1)}%`,
      action: 'Revisar landing page, velocidade de carregamento e congruência com o anúncio.',
      severity: 'high', category: 'post_click', confidence: computeConfidence(3, 0.85),
    };
  }
  // Sweet spot: CPM↓ + CTR↑ + CPA↓
  if (cpmC < -5 && ctrC > 5 && cpaC && cpaC < -5) {
    return {
      id: 'i2-sweetspot', title: 'Sweet Spot — Momento ideal para escalar',
      description: `CPM caiu ${Math.abs(cpmC).toFixed(0)}%, CTR subiu ${ctrC.toFixed(0)}% e CPA caiu ${Math.abs(cpaC).toFixed(0)}%.`,
      evidence: `CPM: ${cpmC.toFixed(1)}%, CTR: +${ctrC.toFixed(1)}%, CPA: ${cpaC.toFixed(1)}%`,
      action: 'Momento ideal para aumentar budget. Aproveitar eficiência de leilão.',
      severity: 'low', category: 'budget', confidence: computeConfidence(3, 0.9),
    };
  }
  return null;
}

// I3: Fadiga confirmada
function checkFatigue(metrics: AggregatedMetrics, delta: DeltaMetrics): InsightCard | null {
  if (!delta.previous) return null;
  const freqHigh = metrics.frequency > THRESHOLDS.frequency_high;
  const ctrDrop = delta.deltas['ctr_link']?.percent;
  const cpaDrop = delta.deltas['cost_per_result']?.percent;
  if (freqHigh && ctrDrop && ctrDrop < THRESHOLDS.ctr_drop_pct && cpaDrop && cpaDrop > 10) {
    return {
      id: 'i3-fatigue', title: 'Fadiga de audiência confirmada',
      description: `Frequência em ${metrics.frequency.toFixed(1)}, CTR caiu ${Math.abs(ctrDrop).toFixed(0)}% e CPA subiu ${cpaDrop.toFixed(0)}%.`,
      evidence: `Freq: ${metrics.frequency.toFixed(1)}, CTR: ${ctrDrop.toFixed(1)}%, CPA: +${cpaDrop.toFixed(1)}%`,
      action: 'Expandir público-alvo, pausar conjuntos saturados ou renovar criativos.',
      severity: 'high', category: 'fatigue', confidence: computeConfidence(3, 0.9),
    };
  }
  return null;
}

// I4: CPC barato-lixo
function checkJunkClicks(metrics: AggregatedMetrics): InsightCard | null {
  if (metrics.cpc_link > 0 && metrics.cost_per_lpv > metrics.cpc_link * THRESHOLDS.cost_lpv_multiplier && metrics.link_clicks > 50) {
    return {
      id: 'i4-junk', title: 'CPC barato, mas clique inútil',
      description: `CPC Link é R$${metrics.cpc_link.toFixed(2)}, mas Custo/LPV é R$${metrics.cost_per_lpv.toFixed(2)} (${(metrics.cost_per_lpv / metrics.cpc_link).toFixed(1)}x maior).`,
      evidence: `CPC: R$${metrics.cpc_link.toFixed(2)}, Custo/LPV: R$${metrics.cost_per_lpv.toFixed(2)}`,
      action: 'Muitos cliques não são qualificados. Revisar segmentação e posicionamento.',
      severity: 'medium', category: 'efficiency', confidence: computeConfidence(2, 0.85),
    };
  }
  return null;
}

// I5: Gargalo pós-clique
function checkPostClickBottleneck(metrics: AggregatedMetrics, delta: DeltaMetrics): InsightCard | null {
  if (!delta.previous) return null;
  const rpLpvC = delta.deltas['result_per_lpv']?.percent;
  if (rpLpvC && rpLpvC < THRESHOLDS.result_per_lpv_drop_pct && metrics.landing_page_views > 50) {
    return {
      id: 'i5-bottleneck', title: 'Gargalo pós-clique: conversão caiu',
      description: `Result/LPV caiu ${Math.abs(rpLpvC).toFixed(0)}%. Menos visitantes estão convertendo.`,
      evidence: `Result/LPV: ${rpLpvC.toFixed(1)}%`,
      action: 'Revisar landing page, formulário e oferta. Testar variações.',
      severity: 'high', category: 'post_click', confidence: computeConfidence(2, 0.8),
    };
  }
  return null;
}

// I6: Pareto de perda
function checkParetoWaste(rows: GroupedRow[], totalSpend: number, avgCostResult: number): InsightCard[] {
  const insights: InsightCard[] = [];
  const wasteful = rows.filter(r =>
    r.metrics.spend_brl > totalSpend * THRESHOLDS.spend_share_threshold &&
    r.metrics.cost_per_result > avgCostResult * THRESHOLDS.cost_result_above_avg &&
    r.metrics.results > 0
  );
  if (wasteful.length > 0) {
    const names = wasteful.map(r => r.name).slice(0, 3);
    const wastedSpend = wasteful.reduce((acc, r) => acc + r.metrics.spend_brl, 0);
    insights.push({
      id: 'i6-pareto', title: `${wasteful.length} item(ns) com CPA acima da média`,
      description: `R$${wastedSpend.toFixed(0)} investidos em itens com CPA ${(THRESHOLDS.cost_result_above_avg * 100 - 100).toFixed(0)}%+ acima da média.`,
      evidence: names.join(', '),
      action: 'Considerar pausar ou otimizar estes itens para realocar budget.',
      severity: 'high', category: 'budget', confidence: computeConfidence(2, 0.85),
      affectedItems: wasteful.map(r => r.key),
    });
  }
  return insights;
}

// I7: Row-level comparative insights
function checkComparativeInsights(rows: GroupedRow[], avgMetrics: AggregatedMetrics): InsightCard[] {
  const insights: InsightCard[] = [];
  if (rows.length < 2) return insights;

  const viable = rows.filter(r => r.metrics.spend_brl > 0 && r.metrics.results > 0);
  if (viable.length >= 2) {
    const byCTR = [...viable].sort((a, b) => b.metrics.ctr_link - a.metrics.ctr_link);
    const byCPA = [...viable].sort((a, b) => a.metrics.cost_per_result - b.metrics.cost_per_result);

    if (byCTR[0].key !== byCPA[0].key && byCTR[0].metrics.ctr_link > byCPA[0].metrics.ctr_link * 1.2) {
      insights.push({
        id: 'i7-misleading-ctr',
        title: 'CTR enganoso entre itens',
        description: `"${byCTR[0].name}" tem CTR maior (${byCTR[0].metrics.ctr_link.toFixed(2)}%) mas CPA pior (R$${byCTR[0].metrics.cost_per_result.toFixed(2)}) que "${byCPA[0].name}" (CTR ${byCPA[0].metrics.ctr_link.toFixed(2)}%, CPA R$${byCPA[0].metrics.cost_per_result.toFixed(2)}).`,
        evidence: `LPV Rate: ${(byCTR[0].metrics.lpv_rate * 100).toFixed(0)}% vs ${(byCPA[0].metrics.lpv_rate * 100).toFixed(0)}%`,
        action: `Manter o gancho de "${byCTR[0].name}" mas testar com o corpo/LP de "${byCPA[0].name}"`,
        severity: 'medium', category: 'creative', confidence: computeConfidence(2, 0.75),
        affectedItems: [byCTR[0].key, byCPA[0].key],
      });
    }

    for (let i = 0; i < Math.min(viable.length, 3); i++) {
      for (let j = i + 1; j < Math.min(viable.length, 3); j++) {
        const a = viable[i], b = viable[j];
        const cpaDiff = Math.abs(a.metrics.cost_per_result - b.metrics.cost_per_result) / Math.max(a.metrics.cost_per_result, b.metrics.cost_per_result);
        if (cpaDiff < 0.15 && Math.abs(a.metrics.frequency - b.metrics.frequency) > 1) {
          const lowerFreq = a.metrics.frequency < b.metrics.frequency ? a : b;
          const higherFreq = a.metrics.frequency < b.metrics.frequency ? b : a;
          insights.push({
            id: `i7-freq-${a.key}-${b.key}`,
            title: 'CPA similar, sustentabilidade diferente',
            description: `"${lowerFreq.name}" e "${higherFreq.name}" têm CPA similar, mas frequências de ${lowerFreq.metrics.frequency.toFixed(1)} vs ${higherFreq.metrics.frequency.toFixed(1)}.`,
            evidence: `Freq: ${lowerFreq.metrics.frequency.toFixed(1)} vs ${higherFreq.metrics.frequency.toFixed(1)}`,
            action: `Escalar "${lowerFreq.name}" primeiro — menor frequência = mais vida útil.`,
            severity: 'low', category: 'efficiency', confidence: computeConfidence(2, 0.7),
            affectedItems: [lowerFreq.key],
          });
          break;
        }
      }
    }
  }

  return insights;
}

// ── I9–I16: Lead quality & creative lifecycle rules ──────────────────────

// I9: Lead não atende — público sem intenção real
function checkLeadNoShow(
  metrics: AggregatedMetrics,
  leadQuality?: LeadQualityMetrics | null
): InsightCard | null {
  if (!leadQuality || leadQuality.leads_total < 20) return null;
  if (leadQuality.taxa_atendimento < THRESHOLDS.taxa_atendimento_low && metrics.spend_brl > 200) {
    return {
      id: 'i9-lead-no-show',
      title: 'Leads não atendem — público sem intenção real',
      description: `Apenas ${(leadQuality.taxa_atendimento * 100).toFixed(0)}% dos leads desta campanha atende contato. Volume alto, qualidade baixa.`,
      evidence: `${Math.round(leadQuality.leads_total * leadQuality.taxa_atendimento)} de ${leadQuality.leads_total} leads atendidos`,
      action: 'Adicionar qualificador na headline ("proprietário de studio" / "para quem quer alugar no Airbnb"). Reduz volume mas aumenta taxa de atendimento.',
      severity: 'high',
      category: 'post_click',
      confidence: computeConfidence(3, 0.85),
    };
  }
  return null;
}

// I10: ROAS real inverte o ranking vs CPA de lead
function checkROASInversion(
  rows: GroupedRow[],
  leadQualityByKey: Record<string, LeadQualityMetrics>
): InsightCard | null {
  const withRoas = rows.filter(r => leadQualityByKey[r.key]?.roas_real > 0);
  if (withRoas.length < 2) return null;

  const byCpaLead = [...withRoas].sort((a, b) => a.metrics.cost_per_result - b.metrics.cost_per_result);
  const byRoas = [...withRoas].sort((a, b) => (leadQualityByKey[b.key]?.roas_real || 0) - (leadQualityByKey[a.key]?.roas_real || 0));

  if (byCpaLead[0].key !== byRoas[0].key) {
    const bestCpa = byCpaLead[0];
    const bestRoas = byRoas[0];
    return {
      id: 'i10-roas-inversion',
      title: 'ROAS real inverte o ranking de campanhas',
      description: `"${bestCpa.name}" tem o menor CPA de lead (R$${bestCpa.metrics.cost_per_result.toFixed(2)}), mas "${bestRoas.name}" tem ROAS real maior (${leadQualityByKey[bestRoas.key].roas_real.toFixed(1)}×).`,
      evidence: `CPA lead: R$${bestCpa.metrics.cost_per_result.toFixed(2)} vs ROAS real: ${leadQualityByKey[bestRoas.key].roas_real.toFixed(1)}×`,
      action: `Migrar budget para "${bestRoas.name}" — gera mais receita por real investido, independente do CPA de lead.`,
      severity: 'high',
      category: 'budget',
      confidence: computeConfidence(3, 0.90),
      affectedItems: [bestRoas.key],
    };
  }
  return null;
}

// I11: Criativo próximo do prazo de expiração
function checkCreativeExpiry(
  creatives: CreativeLifecycleRecord[]
): InsightCard[] {
  const insights: InsightCard[] = [];
  const expiring = creatives.filter(c => {
    const lifespan = CREATIVE_LIFESPAN[c.format || 'default'] || CREATIVE_LIFESPAN.default;
    const pct = c.days_active / lifespan;
    return pct >= 0.8 && c.degradation_pct >= THRESHOLDS.creative_degradation_alert * 100 && c.status !== 'paused';
  });

  for (const c of expiring.slice(0, 3)) {
    const lifespan = CREATIVE_LIFESPAN[c.format || 'default'] || CREATIVE_LIFESPAN.default;
    const daysRemaining = Math.max(0, lifespan - c.days_active);
    insights.push({
      id: `i11-creative-expiry-${c.ad_key}`,
      title: `Criativo expirando em ~${daysRemaining} dias`,
      description: `"${c.ad_name}" está no dia ${c.days_active} de vida útil (~${lifespan}d para ${c.format || 'este formato'}). CTR caiu ${c.degradation_pct.toFixed(0)}% desde o pico.`,
      evidence: `Peak CTR: ${(c.peak_ctr * 100).toFixed(2)}% → Atual: ${(c.current_ctr * 100).toFixed(2)}%`,
      action: 'Preparar novo criativo agora para substituição em 3–5 dias. Não esperar o CPA subir para agir.',
      severity: daysRemaining <= 3 ? 'high' : 'medium',
      category: 'creative',
      confidence: computeConfidence(2, 0.80),
      affectedItems: [c.ad_key],
    });
  }
  return insights;
}

// I12: CPM sobe por concorrência, não por saturação
function checkCPMCause(metrics: AggregatedMetrics, delta: DeltaMetrics): InsightCard | null {
  if (!delta.previous) return null;
  const cpmC = delta.deltas['cpm']?.percent;
  const freqC = delta.deltas['frequency']?.percent;
  const reachC = delta.deltas['reach']?.percent;
  if (cpmC === null || cpmC === undefined || freqC === null || freqC === undefined) return null;

  if (cpmC > 15 && Math.abs(freqC) < 5 && reachC !== null && reachC !== undefined && reachC > 0) {
    return {
      id: 'i12-cpm-auction',
      title: 'CPM sobe por concorrência, não saturação',
      description: `CPM subiu ${cpmC.toFixed(0)}% mas frequência ficou estável e alcance cresceu. O problema é de leilão, não de audiência esgotada.`,
      evidence: `CPM: +${cpmC.toFixed(1)}%, Frequência: ${freqC > 0 ? '+' : ''}${freqC.toFixed(1)}%, Alcance: +${reachC.toFixed(1)}%`,
      action: 'Explorar posicionamentos alternativos (Reels, Stories) onde o leilão é menos disputado. Não troque criativos — o problema não é criativo.',
      severity: 'medium',
      category: 'auction',
      confidence: computeConfidence(3, 0.80),
    };
  }
  return null;
}

// I13: CTR alto + taxa de agendamento baixa
function checkHighCTRLowBooking(
  metrics: AggregatedMetrics,
  leadQuality?: LeadQualityMetrics | null
): InsightCard | null {
  if (!leadQuality || leadQuality.leads_total < 15) return null;
  if (metrics.ctr_link >= 4.0 && leadQuality.taxa_agendamento < 0.15) {
    return {
      id: 'i13-ctr-booking-gap',
      title: 'CTR alto, mas poucos agendamentos',
      description: `CTR de ${metrics.ctr_link.toFixed(1)}% indica criativo forte, mas apenas ${(leadQuality.taxa_agendamento * 100).toFixed(0)}% dos leads viram visita agendada.`,
      evidence: `CTR: ${metrics.ctr_link.toFixed(1)}% (bom) | Agendamentos: ${(leadQuality.taxa_agendamento * 100).toFixed(0)}% (baixo)`,
      action: 'O problema não é mídia — é o processo de qualificação comercial. Revisar a abordagem de primeiro contato com o lead.',
      severity: 'medium',
      category: 'post_click',
      confidence: computeConfidence(2, 0.75),
    };
  }
  return null;
}

// I14: Budget desperdiçado em fase de aprendizado
function checkLearningPhase(rows: GroupedRow[]): InsightCard[] {
  const insights: InsightCard[] = [];
  const inLearning = rows.filter(r =>
    r.metrics.results < THRESHOLDS.learning_phase_results &&
    r.metrics.spend_brl > THRESHOLDS.learning_phase_min_spend
  );
  if (inLearning.length > 0) {
    const names = inLearning.map(r => r.name).slice(0, 2);
    const totalWasted = inLearning.reduce((acc, r) => acc + r.metrics.spend_brl, 0);
    insights.push({
      id: 'i14-learning-phase',
      title: `${inLearning.length} item(ns) presos na fase de aprendizado`,
      description: `R$${totalWasted.toFixed(0)} investidos em itens com menos de ${THRESHOLDS.learning_phase_results} resultados no período. O Meta não tem sinal suficiente para otimizar.`,
      evidence: names.join(', '),
      action: 'Consolidar conjuntos menores, ampliar público mínimo para 1M+ ou aumentar orçamento diário para forçar saída do aprendizado mais rápido.',
      severity: 'medium',
      category: 'budget',
      confidence: computeConfidence(2, 0.80),
      affectedItems: inLearning.map(r => r.key),
    });
  }
  return insights;
}

// I15: Momento confirmado de escala (ROAS real + frequência baixa)
function checkScaleMoment(
  metrics: AggregatedMetrics,
  delta: DeltaMetrics,
  leadQuality?: LeadQualityMetrics | null
): InsightCard | null {
  if (!leadQuality) return null;
  const cpaC = delta.deltas['cost_per_result']?.percent;
  if (
    leadQuality.roas_real >= THRESHOLDS.roas_real_scale &&
    metrics.frequency < 1.5 &&
    cpaC && cpaC < -10
  ) {
    return {
      id: 'i15-scale-moment',
      title: '🚀 Momento confirmado para escalar',
      description: `ROAS real de ${leadQuality.roas_real.toFixed(1)}×, CPA de lead caindo ${Math.abs(cpaC).toFixed(0)}% e frequência baixa (${metrics.frequency.toFixed(1)}). Audiência não saturada.`,
      evidence: `ROAS: ${leadQuality.roas_real.toFixed(1)}×, Frequência: ${metrics.frequency.toFixed(1)}, CPA: ${cpaC.toFixed(1)}%`,
      action: 'Aumentar budget 20–30% por semana. Não mais que isso — aumentos bruscos reiniciam a fase de aprendizado.',
      severity: 'low',
      category: 'budget',
      confidence: computeConfidence(3, 0.90),
    };
  }
  return null;
}

// I16: Hook type com melhor taxa de atendimento
function checkBestHookType(
  creatives: CreativeLifecycleRecord[],
  leadQualityByKey: Record<string, LeadQualityMetrics>
): InsightCard | null {
  const byHook: Record<string, { atendimentos: number; total: number }> = {};
  for (const c of creatives) {
    if (!c.hook_type) continue;
    const lq = leadQualityByKey[c.ad_key];
    if (!lq || lq.leads_total < 10) continue;
    if (!byHook[c.hook_type]) byHook[c.hook_type] = { atendimentos: 0, total: 0 };
    byHook[c.hook_type].atendimentos += Math.round(lq.leads_total * lq.taxa_atendimento);
    byHook[c.hook_type].total += lq.leads_total;
  }
  const hooks = Object.entries(byHook)
    .filter(([, v]) => v.total >= 20)
    .map(([hook, v]) => ({ hook, taxa: v.atendimentos / v.total }))
    .sort((a, b) => b.taxa - a.taxa);

  if (hooks.length >= 2 && hooks[0].taxa - hooks[hooks.length - 1].taxa > 0.15) {
    return {
      id: 'i16-hook-type',
      title: `Hook "${hooks[0].hook}" converte ${((hooks[0].taxa - hooks[hooks.length - 1].taxa) * 100).toFixed(0)}% mais`,
      description: `Criativos com hook "${hooks[0].hook}" têm taxa de atendimento de ${(hooks[0].taxa * 100).toFixed(0)}% vs ${(hooks[hooks.length - 1].taxa * 100).toFixed(0)}% do hook "${hooks[hooks.length - 1].hook}".`,
      evidence: hooks.map(h => `${h.hook}: ${(h.taxa * 100).toFixed(0)}%`).join(' | '),
      action: `Priorizar hook "${hooks[0].hook}" nos próximos criativos. Dados baseados em taxa de atendimento real, não em CTR.`,
      severity: 'low',
      category: 'creative',
      confidence: computeConfidence(2, 0.75),
    };
  }
  return null;
}

// I17: CPM alto + CTR(link) fraco → Hook fraco
function checkWeakHook(metrics: AggregatedMetrics): InsightCard | null {
  if (metrics.impressions < THRESHOLDS.min_impressions) return null;
  if (metrics.cpm > THRESHOLDS.cpm_high && metrics.ctr_link < THRESHOLDS.ctr_link_weak) {
    return {
      id: 'i17-weak-hook',
      title: 'Hook fraco — CPM alto + CTR baixo',
      description: `CPM de R$${metrics.cpm.toFixed(2)} com CTR Link de apenas ${metrics.ctr_link.toFixed(2)}%. O criativo não captura atenção suficiente para justificar o custo do leilão.`,
      evidence: `CPM: R$${metrics.cpm.toFixed(2)} (>${THRESHOLDS.cpm_high}) | CTR Link: ${metrics.ctr_link.toFixed(2)}% (<${THRESHOLDS.ctr_link_weak}%)`,
      action: 'Subir novos ângulos criativos. Priorizar formato 9:16 com demonstração nos primeiros 3s. Testar pelo menos 3 variações de hook.',
      severity: 'high',
      category: 'creative',
      confidence: computeConfidence(2, 0.90),
    };
  }
  if (metrics.cpm <= THRESHOLDS.cpm_high && metrics.ctr_link < THRESHOLDS.ctr_link_weak && metrics.impressions > 5000) {
    return {
      id: 'i17-weak-hook-cheap',
      title: 'CTR fraco mesmo com CPM baixo — criativo não engaja',
      description: `CPM acessível (R$${metrics.cpm.toFixed(2)}) mas CTR Link de ${metrics.ctr_link.toFixed(2)}%. O leilão está barato, mas o criativo não converte atenção em clique.`,
      evidence: `CPM: R$${metrics.cpm.toFixed(2)} | CTR Link: ${metrics.ctr_link.toFixed(2)}%`,
      action: 'Oportunidade: leilão favorável. Trocar o criativo agora para aproveitar CPM baixo. Testar hooks mais diretos e CTAs claros.',
      severity: 'medium',
      category: 'creative',
      confidence: computeConfidence(2, 0.80),
    };
  }
  return null;
}

// I18: CTR bom + CVR LP baixo → Problema na Landing Page
function checkLPConversion(metrics: AggregatedMetrics): InsightCard | null {
  if (metrics.impressions < THRESHOLDS.min_impressions || metrics.link_clicks < 30) return null;
  const cvrLP = metrics.result_per_lpv;

  if (metrics.ctr_link >= THRESHOLDS.ctr_link_good && cvrLP < THRESHOLDS.cvr_lp_low && metrics.landing_page_views > 20) {
    const isCritical = cvrLP < THRESHOLDS.cvr_lp_very_low;
    return {
      id: 'i18-lp-conversion',
      title: isCritical ? '🚨 Landing page com conversão crítica' : 'CTR bom, mas LP não converte',
      description: `CTR Link de ${metrics.ctr_link.toFixed(2)}% mostra que o criativo funciona, mas apenas ${(cvrLP * 100).toFixed(1)}% dos visitantes da LP convertem.`,
      evidence: `CTR Link: ${metrics.ctr_link.toFixed(2)}% (✓) | CVR LP: ${(cvrLP * 100).toFixed(1)}% (✗) | LPVs: ${metrics.landing_page_views}`,
      action: isCritical
        ? 'Urgente: revisar LP inteira — headline, oferta, formulário e velocidade. Considerar teste A/B de página.'
        : 'Mexer na página: revisar headline, CTA, prova social e formulário. Verificar velocidade de carregamento.',
      severity: isCritical ? 'high' : 'medium',
      category: 'post_click',
      confidence: computeConfidence(2, 0.85),
    };
  }
  return null;
}

// I19: CTR bom + LPV Rate baixo → Clique não chega na página
function checkClickLeakage(metrics: AggregatedMetrics): InsightCard | null {
  if (metrics.link_clicks < 50) return null;
  if (metrics.ctr_link >= THRESHOLDS.ctr_link_good && metrics.lpv_rate < THRESHOLDS.lpv_rate_critical) {
    return {
      id: 'i19-click-leakage',
      title: 'Vazamento de cliques — visitantes não chegam à LP',
      description: `CTR de ${metrics.ctr_link.toFixed(2)}% é bom, mas apenas ${(metrics.lpv_rate * 100).toFixed(0)}% dos cliques viram LPV. Perda de ${(100 - metrics.lpv_rate * 100).toFixed(0)}% dos cliques.`,
      evidence: `CTR: ${metrics.ctr_link.toFixed(2)}% | LPV Rate: ${(metrics.lpv_rate * 100).toFixed(0)}% | Cliques perdidos: ~${Math.round(metrics.link_clicks * (1 - metrics.lpv_rate))}`,
      action: 'Verificar: 1) Velocidade da LP (<3s), 2) Redirecionamentos quebrados, 3) LP não responsiva mobile, 4) Cliques acidentais em Audience Network.',
      severity: 'high',
      category: 'post_click',
      confidence: computeConfidence(2, 0.85),
    };
  }
  return null;
}

// I20: CPC barato + sem resultado → Vanity clicks
function checkVanityClicks(metrics: AggregatedMetrics): InsightCard | null {
  if (metrics.link_clicks < 50 || metrics.landing_page_views < 20) return null;
  if (
    metrics.cpc_link > 0 && metrics.cpc_link < THRESHOLDS.cpc_link_cheap_threshold &&
    metrics.ctr_link >= THRESHOLDS.ctr_link_good &&
    metrics.result_per_lpv < THRESHOLDS.result_per_lpv_low
  ) {
    return {
      id: 'i20-vanity-clicks',
      title: 'Cliques baratos sem conversão — tráfego de vaidade',
      description: `CPC R$${metrics.cpc_link.toFixed(2)} e CTR ${metrics.ctr_link.toFixed(2)}% parecem ótimos, mas só ${(metrics.result_per_lpv * 100).toFixed(1)}% dos visitantes convertem.`,
      evidence: `CPC: R$${metrics.cpc_link.toFixed(2)} (barato) | CTR: ${metrics.ctr_link.toFixed(2)}% | CVR LP: ${(metrics.result_per_lpv * 100).toFixed(1)}%`,
      action: 'Revisar segmentação: excluir Audience Network. Testar otimização para conversão em vez de cliques no link.',
      severity: 'medium',
      category: 'efficiency',
      confidence: computeConfidence(3, 0.85),
    };
  }
  return null;
}

// Main
export function generateInsights(
  metrics: AggregatedMetrics,
  delta: DeltaMetrics,
  rows: GroupedRow[],
  leadQuality?: LeadQualityMetrics | null,
  leadQualityByKey?: Record<string, LeadQualityMetrics>,
  creatives?: CreativeLifecycleRecord[]
): InsightCard[] {
  const insights: InsightCard[] = [];
  if (metrics.spend_brl < THRESHOLDS.min_spend_for_insight) return insights;

  // I1–I7: existing rules
  const i1 = checkCTRDeception(metrics);
  if (i1) insights.push(i1);
  const i2 = checkSacredTriangle(metrics, delta);
  if (i2) insights.push(i2);
  const i3 = checkFatigue(metrics, delta);
  if (i3) insights.push(i3);
  const i4 = checkJunkClicks(metrics);
  if (i4) insights.push(i4);
  const i5 = checkPostClickBottleneck(metrics, delta);
  if (i5) insights.push(i5);
  insights.push(...checkParetoWaste(rows, metrics.spend_brl, metrics.cost_per_result));
  insights.push(...checkComparativeInsights(rows, metrics));

  // I9–I16: Lead quality & creative rules
  const i9 = checkLeadNoShow(metrics, leadQuality);
  if (i9) insights.push(i9);

  if (leadQualityByKey && Object.keys(leadQualityByKey).length > 0) {
    const i10 = checkROASInversion(rows, leadQualityByKey);
    if (i10) insights.push(i10);
  }

  if (creatives && creatives.length > 0) {
    insights.push(...checkCreativeExpiry(creatives));
  }

  const i12 = checkCPMCause(metrics, delta);
  if (i12) insights.push(i12);

  const i13 = checkHighCTRLowBooking(metrics, leadQuality);
  if (i13) insights.push(i13);

  insights.push(...checkLearningPhase(rows));

  const i15 = checkScaleMoment(metrics, delta, leadQuality);
  if (i15) insights.push(i15);

  if (creatives && leadQualityByKey) {
    const i16 = checkBestHookType(creatives, leadQualityByKey);
    if (i16) insights.push(i16);
  }

  // I17–I20: Cross-diagnostic rules
  const i17 = checkWeakHook(metrics);
  if (i17) insights.push(i17);
  const i18 = checkLPConversion(metrics);
  if (i18) insights.push(i18);
  const i19 = checkClickLeakage(metrics);
  if (i19) insights.push(i19);
  const i20 = checkVanityClicks(metrics);
  if (i20) insights.push(i20);

  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
