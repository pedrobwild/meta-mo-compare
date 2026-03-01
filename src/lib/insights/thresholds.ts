// Default thresholds for insight rules
export const THRESHOLDS = {
  // I1: CTR engana
  lpv_rate_low: 0.60, // below this = landing page mismatch

  // I3: Fadiga
  frequency_high: 3.0,
  ctr_drop_pct: -10, // %

  // I4: CPC barato-lixo
  cost_lpv_multiplier: 2.5, // cost/lpv > cpc * this = junk clicks

  // I5: Gargalo pós-clique
  result_per_lpv_drop_pct: -10, // %

  // I6: Pareto de perda
  spend_share_threshold: 0.10, // top items with >10% spend
  cost_result_above_avg: 1.3, // 30% above average

  // General
  min_spend_for_insight: 50, // R$ minimum to consider
  min_impressions: 1000,

  // I9–I16: Lead quality & creative thresholds
  taxa_atendimento_low: 0.40,
  roas_real_scale: 3.0,
  roas_real_warning: 1.5,
  ctr_high_for_matrix: 0.035,
  lpv_rate_high_for_matrix: 0.75,
  creative_degradation_alert: 0.25,
  creative_degradation_pause: 0.50,
  learning_phase_results: 50,
  learning_phase_min_spend: 150,
};
