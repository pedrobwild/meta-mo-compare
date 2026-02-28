export type SourceType = 'type1_ad_only' | 'type2_ad_campaign' | 'type3_full';

export interface MetaRecord {
  // Keys
  month_key: string;
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

  // Metrics
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

  // Dates
  report_start: string | null;
  report_end: string | null;
}

export interface ImportLog {
  id: string;
  timestamp: Date;
  filename: string;
  source_type: SourceType;
  month_key: string;
  records_count: number;
  status: 'success' | 'warning' | 'error';
  message: string;
}

export interface MonthlyTargets {
  month_key: string;
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

export interface FunnelData {
  month_key: string;
  mql: number;
  sql: number;
  vendas: number;
  receita: number;
}

export interface AggregatedMetrics {
  spend_brl: number;
  impressions: number;
  link_clicks: number;
  clicks_all: number;
  results: number;
  reach: number;
  landing_page_views: number;
  // Calculated
  ctr_link: number;
  cpc_link: number;
  cpm: number;
  cost_per_result: number;
  cost_per_lpv: number;
  frequency: number;
  ctr_all: number;
  cpc_all: number;
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
  targets: MonthlyTargets[];
  funnelData: FunnelData[];
  hierarchyMaps: HierarchyMaps;
  truthSource: TruthSource;
  selectedMonth: string | null;
  comparisonMonth: string | null;
  analysisLevel: AnalysisLevel;
  searchQuery: string;
  includeInactive: boolean;
}
