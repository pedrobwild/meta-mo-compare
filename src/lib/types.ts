// === Period & Granularity ===
export type PeriodGranularity = 'week' | 'day';
export type PeriodKey = string; // "YYYY-Www" for week, "YYYY-MM-DD" for day

export type SourceType = 'type1_ad_only' | 'type2_ad_campaign' | 'type3_full';

export interface MetaRecord {
  // Period keys (NEW — primary)
  period_start: string;   // ISO date "YYYY-MM-DD"
  period_end: string;     // ISO date "YYYY-MM-DD"
  period_key: PeriodKey;
  granularity: PeriodGranularity;

  // Legacy (kept for migration compatibility, derived from period_start)
  month_key: string;

  // Identity keys
  ad_key: string;
  campaign_key: string | null;
  adset_key: string | null;
  source_type: SourceType;
  unique_key: string;

  // Dimensions
  ad_name: string;
  campaign_name: string | null;
  adset_name: string | null;
  delivery_status: string | null;
  delivery_level: string | null;
  result_type: string | null;

  // Raw metrics from export
  results: number;
  reach: number;
  frequency: number;
  cost_per_result: number;
  spend_brl: number;
  impressions: number;
  cpm: number;
  link_clicks: number;
  cpc_link: number;
  ctr_link: number;
  clicks_all: number;
  ctr_all: number;
  cpc_all: number;
  landing_page_views: number;
  cost_per_lpv: number;

  // Date range from export (raw)
  report_start: string | null;
  report_end: string | null;
}

export interface ImportLog {
  id: string;
  timestamp: Date;
  filename: string;
  source_type: SourceType;
  period_key: PeriodKey;
  granularity: PeriodGranularity;
  records_count: number;
  status: 'success' | 'warning' | 'error';
  message: string;
}

export interface PeriodTargets {
  period_key: PeriodKey;
  granularity: PeriodGranularity;
  spend?: number;
  results?: number;
  ctr_link?: number;
  cpc_link?: number;
  cpm?: number;
  lpv?: number;
  cost_per_result?: number;
  cost_per_lpv?: number;
  mql?: number;
  sql?: number;
  vendas?: number;
  receita?: number;
  roas?: number;
}

// Legacy alias for migration
export type MonthlyTargets = PeriodTargets;

// ── Lead Quality (funil real de negócio) ──────────────────────────────────

export interface LeadQualityRecord {
  id: string;
  workspace_id: string;
  date: string;
  campaign_key: string;
  adset_key?: string | null;
  ad_key?: string | null;
  leads_total: number;
  leads_atendidos: number;
  leads_qualificados: number;
  visitas_agendadas: number;
  propostas_enviadas: number;
  contratos_fechados: number;
  receita_brl: number;
  notes?: string | null;
}

export interface LeadQualityMetrics {
  campaign_key: string;
  leads_total: number;
  taxa_atendimento: number;       // leads_atendidos / leads_total
  taxa_qualificacao: number;      // leads_qualificados / leads_total
  taxa_agendamento: number;       // visitas_agendadas / leads_total
  taxa_fechamento: number;        // contratos_fechados / leads_total
  cpa_reuniao: number;            // spend_brl / visitas_agendadas
  cpa_contrato: number;           // spend_brl / contratos_fechados
  roas_real: number;              // receita_brl / spend_brl
  receita_por_lead: number;       // receita_brl / leads_total
  receita_brl: number;
  contratos_fechados: number;
}

// ── Creative Lifecycle ────────────────────────────────────────────────────

export type CreativeStatus = 'fresh' | 'peaking' | 'declining' | 'fatigued';

export interface CreativeLifecycleRecord {
  id: string;
  workspace_id: string;
  ad_key: string;
  ad_name: string;
  campaign_key?: string | null;
  adset_key?: string | null;
  format?: string | null;
  hook_type?: string | null;
  activated_at?: string | null;
  days_active: number;
  peak_ctr: number;
  peak_ctr_date?: string | null;
  current_ctr: number;
  degradation_pct: number;
  status: string;
}

// Vida útil média por formato (em dias) — atualizada com dados históricos
export const CREATIVE_LIFESPAN: Record<string, number> = {
  video: 14,
  image: 21,
  carousel: 28,
  stories: 10,
  default: 18,
};

export interface FunnelData {
  period_key: PeriodKey;
  granularity: PeriodGranularity;
  mql: number;
  sql: number;
  vendas: number;
  receita: number;
}

export interface AggregatedMetrics {
  // Raw sums
  spend_brl: number;
  impressions: number;
  link_clicks: number;
  clicks_all: number;
  results: number;
  reach: number;
  landing_page_views: number;
  // Calculated ratios
  ctr_link: number;
  cpc_link: number;
  cpm: number;
  cost_per_result: number;
  cost_per_lpv: number;
  frequency: number;
  ctr_all: number;
  cpc_all: number;
  // Derived metrics (OBRIGATÓRIOS)
  lpv_rate: number;         // lpv / link_clicks
  qualified_ctr: number;    // lpv / impressions
  result_per_lpv: number;   // results / lpv
}

export interface DeltaMetrics {
  current: AggregatedMetrics;
  previous: AggregatedMetrics | null;
  deltas: Record<string, { absolute: number; percent: number | null }>;
}

export type AnalysisLevel = 'campaign' | 'adset' | 'ad';

export type TruthSource = SourceType;

export interface HierarchyMaps {
  ad_to_adset: Record<string, string>;
  ad_to_campaign: Record<string, string>;
  adset_to_campaign: Record<string, string>;
}

export interface AppState {
  records: MetaRecord[];
  importLogs: ImportLog[];
  targets: PeriodTargets[];
  funnelData: FunnelData[];
  leadQuality: LeadQualityRecord[];
  hierarchyMaps: HierarchyMaps;
  truthSource: TruthSource;
  // Date range selection (primary)
  dateFrom: string | null;     // "YYYY-MM-DD"
  dateTo: string | null;       // "YYYY-MM-DD"
  comparisonFrom: string | null;
  comparisonTo: string | null;
  // Legacy period selection (derived, kept for targets/funnel compat)
  selectedGranularity: PeriodGranularity;
  selectedPeriodKey: string | null;
  comparisonPeriodKey: string | null;
  // Analysis
  analysisLevel: AnalysisLevel;
  searchQuery: string;
  includeInactive: boolean;
}
