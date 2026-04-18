// ─── Data Quality Scoring ───
// Assigns a 0-100 score per MetaRecord (and an aggregated workspace score)
// based on completeness, internal consistency and coherence between metrics.
// The goal is to surface "analise com cuidado: esses números parecem estranhos"
// rather than silently producing wrong insights.

import type { MetaRecord } from './types';

export interface RecordQualityIssue {
  code: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface RecordQuality {
  record: MetaRecord;
  score: number; // 0-100
  issues: RecordQualityIssue[];
}

export interface WorkspaceQuality {
  score: number;
  totalRecords: number;
  recordsWithIssues: number;
  issueCountsByCode: Record<string, number>;
  worstRecords: RecordQuality[];
  /** Coverage breakdown for the dataset as a whole. */
  coverage: {
    hasCampaignName: number;
    hasAdsetName: number;
    hasDeliveryStatus: number;
    hasResultType: number;
    hasLpv: number;
    hasLinkClicks: number;
  };
}

const EPS = 1e-9;

/**
 * Scores a single record. Each issue has a penalty that combines to a 0-100 score.
 * The weights target what's most likely to mislead analysis (spend with no
 * impressions, impossible ratios, etc.).
 */
export function scoreRecord(record: MetaRecord): RecordQuality {
  const issues: RecordQualityIssue[] = [];
  let penalty = 0;

  const addIssue = (code: string, severity: RecordQualityIssue['severity'], message: string, cost: number) => {
    issues.push({ code, severity, message });
    penalty += cost;
  };

  // ─ Completeness ─
  if (!record.ad_name) addIssue('missing_ad_name', 'high', 'Nome do anúncio ausente', 40);
  if (!record.campaign_name && !record.adset_name) {
    addIssue('missing_hierarchy', 'medium', 'Sem campanha ou conjunto — agregações ficam genéricas', 8);
  }
  if (!record.period_start || record.period_start === 'unknown') {
    addIssue('missing_date', 'high', 'Sem data no período — não pode ir para comparações temporais', 30);
  }

  // ─ Internal coherence ─
  if (record.spend_brl > 0 && record.impressions === 0) {
    addIssue('spend_without_impressions', 'high', 'Gasto registrado mas zero impressões — provável falha de export', 25);
  }
  if (record.impressions > 0 && record.reach === 0) {
    addIssue('impressions_without_reach', 'medium', 'Impressões sem alcance — verificar export', 6);
  }
  if (record.reach > 0 && record.impressions < record.reach) {
    addIssue('impressions_lt_reach', 'medium', 'Impressões menores que alcance (impossível)', 15);
  }
  if (record.clicks_all > 0 && record.link_clicks > record.clicks_all) {
    addIssue('link_clicks_gt_all_clicks', 'medium', 'Cliques no link maiores que cliques totais', 10);
  }
  if (record.link_clicks > 0 && record.landing_page_views > record.link_clicks * 1.05) {
    addIssue('lpv_gt_link_clicks', 'medium', 'LPV maior que cliques no link (>5% de tolerância)', 10);
  }
  if (record.frequency > 0 && record.reach > 0 && record.impressions > 0) {
    const impliedFrequency = record.impressions / record.reach;
    const diff = Math.abs(record.frequency - impliedFrequency) / (impliedFrequency || EPS);
    if (diff > 0.25) {
      addIssue(
        'frequency_inconsistent',
        'low',
        `Frequência reportada ${record.frequency.toFixed(2)} não bate com impressions/reach (${impliedFrequency.toFixed(2)})`,
        4,
      );
    }
  }

  // ─ Derived sanity ─
  if (record.cpc_link > 0 && record.link_clicks > 0) {
    const impliedCpc = record.spend_brl / record.link_clicks;
    const diff = Math.abs(record.cpc_link - impliedCpc) / (impliedCpc || EPS);
    if (diff > 0.2) {
      addIssue('cpc_mismatch', 'low', 'CPC link não bate com spend / link_clicks', 3);
    }
  }
  if (record.ctr_link > 0 && record.impressions > 0) {
    const impliedCtr = (record.link_clicks / record.impressions) * 100;
    const diff = Math.abs(record.ctr_link - impliedCtr) / (impliedCtr || EPS);
    if (diff > 0.2) {
      addIssue('ctr_mismatch', 'low', 'CTR link não bate com link_clicks / impressions', 3);
    }
  }
  if (record.cost_per_result > 0 && record.results > 0) {
    const implied = record.spend_brl / record.results;
    const diff = Math.abs(record.cost_per_result - implied) / (implied || EPS);
    if (diff > 0.2) {
      addIssue('cost_per_result_mismatch', 'low', 'Custo/resultado não bate com spend / results', 3);
    }
  }

  // ─ Outliers that usually mean broken data ─
  if (record.ctr_link > 25) {
    addIssue('ctr_implausible', 'medium', `CTR de ${record.ctr_link.toFixed(1)}% é improvável`, 8);
  }
  if (record.frequency > 25) {
    addIssue('frequency_implausible', 'medium', `Frequência de ${record.frequency.toFixed(1)} é improvável`, 6);
  }
  if (record.cpm > 500) {
    addIssue('cpm_implausible', 'low', `CPM de R$${record.cpm.toFixed(0)} parece extremo`, 4);
  }

  const score = Math.max(0, Math.min(100, 100 - penalty));
  return { record, score, issues };
}

/**
 * Aggregate quality across all records. Returns a dashboard-ready summary.
 */
export function scoreWorkspace(records: MetaRecord[]): WorkspaceQuality {
  if (records.length === 0) {
    return {
      score: 0,
      totalRecords: 0,
      recordsWithIssues: 0,
      issueCountsByCode: {},
      worstRecords: [],
      coverage: {
        hasCampaignName: 0,
        hasAdsetName: 0,
        hasDeliveryStatus: 0,
        hasResultType: 0,
        hasLpv: 0,
        hasLinkClicks: 0,
      },
    };
  }

  const graded = records.map(scoreRecord);
  const issueCounts: Record<string, number> = {};
  let recordsWithIssues = 0;
  let sum = 0;
  for (const g of graded) {
    if (g.issues.length > 0) recordsWithIssues++;
    for (const issue of g.issues) {
      issueCounts[issue.code] = (issueCounts[issue.code] || 0) + 1;
    }
    sum += g.score;
  }
  const avg = sum / graded.length;
  const worst = [...graded].sort((a, b) => a.score - b.score).slice(0, 25);

  const n = records.length;
  const coverage = {
    hasCampaignName: records.filter((r) => r.campaign_name).length / n,
    hasAdsetName: records.filter((r) => r.adset_name).length / n,
    hasDeliveryStatus: records.filter((r) => r.delivery_status).length / n,
    hasResultType: records.filter((r) => r.result_type).length / n,
    hasLpv: records.filter((r) => r.landing_page_views > 0).length / n,
    hasLinkClicks: records.filter((r) => r.link_clicks > 0).length / n,
  };

  return {
    score: Math.round(avg),
    totalRecords: records.length,
    recordsWithIssues,
    issueCountsByCode: issueCounts,
    worstRecords: worst,
    coverage,
  };
}
