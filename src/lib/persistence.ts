import { supabase } from '@/integrations/supabase/client';
import type { MetaRecord, PeriodTargets, FunnelData, LeadQualityRecord, SourceType, PeriodGranularity } from './types';

export async function loadRecords(): Promise<MetaRecord[]> {
  const { data, error } = await supabase
    .from('meta_records')
    .select('*')
    .order('period_start', { ascending: false });

  if (error) {
    console.error('Error loading records:', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    unique_key: r.unique_key,
    period_start: r.period_start || r.report_start || 'unknown',
    period_end: r.period_end || r.report_end || 'unknown',
    period_key: r.period_key || r.month_key || 'unknown',
    granularity: (r.granularity || 'week') as PeriodGranularity,
    month_key: r.month_key,
    ad_key: r.ad_key,
    campaign_key: r.campaign_key,
    adset_key: r.adset_key,
    source_type: r.source_type as SourceType,
    ad_name: r.ad_name,
    campaign_name: r.campaign_name,
    adset_name: r.adset_name,
    delivery_status: r.delivery_status,
    delivery_level: r.delivery_level,
    result_type: r.result_type,
    results: Number(r.results),
    reach: Number(r.reach),
    frequency: Number(r.frequency),
    cost_per_result: Number(r.cost_per_result),
    spend_brl: Number(r.spend_brl),
    impressions: Number(r.impressions),
    cpm: Number(r.cpm),
    link_clicks: Number(r.link_clicks),
    cpc_link: Number(r.cpc_link),
    ctr_link: Number(r.ctr_link),
    clicks_all: Number(r.clicks_all),
    ctr_all: Number(r.ctr_all),
    cpc_all: Number(r.cpc_all),
    landing_page_views: Number(r.landing_page_views),
    cost_per_lpv: Number(r.cost_per_lpv),
    report_start: r.report_start,
    report_end: r.report_end,
  }));
}

export async function saveRecords(records: MetaRecord[]): Promise<void> {
  if (records.length === 0) return;

  const rows = records.map(r => ({
    unique_key: r.unique_key,
    period_start: r.period_start,
    period_end: r.period_end,
    period_key: r.period_key,
    granularity: r.granularity,
    month_key: r.month_key,
    ad_key: r.ad_key,
    campaign_key: r.campaign_key,
    adset_key: r.adset_key,
    source_type: r.source_type,
    ad_name: r.ad_name,
    campaign_name: r.campaign_name,
    adset_name: r.adset_name,
    delivery_status: r.delivery_status,
    delivery_level: r.delivery_level,
    result_type: r.result_type,
    results: r.results,
    reach: r.reach,
    frequency: r.frequency,
    cost_per_result: r.cost_per_result,
    spend_brl: r.spend_brl,
    impressions: r.impressions,
    cpm: r.cpm,
    link_clicks: r.link_clicks,
    cpc_link: r.cpc_link,
    ctr_link: r.ctr_link,
    clicks_all: r.clicks_all,
    ctr_all: r.ctr_all,
    cpc_all: r.cpc_all,
    landing_page_views: r.landing_page_views,
    cost_per_lpv: r.cost_per_lpv,
    report_start: r.report_start,
    report_end: r.report_end,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from('meta_records')
      .upsert(batch as any, { onConflict: 'unique_key,period_key,granularity' });
    if (error) console.error('Error saving records batch:', error);
  }
}

export async function loadTargets(): Promise<PeriodTargets[]> {
  const { data, error } = await supabase
    .from('monthly_targets')
    .select('*');

  if (error) {
    console.error('Error loading targets:', error);
    return [];
  }

  return (data || []).map((t: any) => ({
    period_key: t.period_key || t.month_key,
    granularity: (t.granularity || 'week') as PeriodGranularity,
    spend: t.spend != null ? Number(t.spend) : undefined,
    results: t.results != null ? Number(t.results) : undefined,
    ctr_link: t.ctr_link != null ? Number(t.ctr_link) : undefined,
    cpc_link: t.cpc_link != null ? Number(t.cpc_link) : undefined,
    cpm: t.cpm != null ? Number(t.cpm) : undefined,
    lpv: t.lpv != null ? Number(t.lpv) : undefined,
    cost_per_result: t.cost_per_result != null ? Number(t.cost_per_result) : undefined,
    cost_per_lpv: t.cost_per_lpv != null ? Number(t.cost_per_lpv) : undefined,
    mql: t.mql != null ? Number(t.mql) : undefined,
    sql: t.sql_target != null ? Number(t.sql_target) : undefined,
    vendas: t.vendas != null ? Number(t.vendas) : undefined,
    receita: t.receita != null ? Number(t.receita) : undefined,
    roas: t.roas != null ? Number(t.roas) : undefined,
  }));
}

export async function saveTarget(target: PeriodTargets): Promise<void> {
  const row = {
    period_key: target.period_key,
    granularity: target.granularity,
    month_key: target.period_key, // backward compat
    spend: target.spend ?? null,
    results: target.results ?? null,
    ctr_link: target.ctr_link ?? null,
    cpc_link: target.cpc_link ?? null,
    cpm: target.cpm ?? null,
    lpv: target.lpv ?? null,
    cost_per_result: target.cost_per_result ?? null,
    cost_per_lpv: target.cost_per_lpv ?? null,
    mql: target.mql ?? null,
    sql_target: target.sql ?? null,
    vendas: target.vendas ?? null,
    receita: target.receita ?? null,
    roas: target.roas ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('monthly_targets')
    .upsert(row as any, { onConflict: 'month_key' });
  if (error) console.error('Error saving target:', error);
}

export async function loadFunnelData(): Promise<FunnelData[]> {
  const { data, error } = await supabase
    .from('funnel_data')
    .select('*');

  if (error) {
    console.error('Error loading funnel data:', error);
    return [];
  }

  return (data || []).map((f: any) => ({
    period_key: f.period_key || f.month_key,
    granularity: (f.granularity || 'week') as PeriodGranularity,
    mql: Number(f.mql),
    sql: Number(f.sql_count),
    vendas: Number(f.vendas),
    receita: Number(f.receita),
  }));
}

export async function saveFunnel(funnel: FunnelData): Promise<void> {
  const row = {
    period_key: funnel.period_key,
    granularity: funnel.granularity,
    month_key: funnel.period_key, // backward compat
    mql: funnel.mql,
    sql_count: funnel.sql,
    vendas: funnel.vendas,
    receita: funnel.receita,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('funnel_data')
    .upsert(row as any, { onConflict: 'month_key' });
  if (error) console.error('Error saving funnel:', error);
}

export async function loadLeadQuality(workspaceId?: string): Promise<LeadQualityRecord[]> {
  let query = supabase.from('lead_quality').select('*').order('date', { ascending: false });
  if (workspaceId) query = query.eq('workspace_id', workspaceId);

  const { data, error } = await query;
  if (error) {
    console.error('Error loading lead quality:', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    workspace_id: r.workspace_id,
    date: r.date,
    campaign_key: r.campaign_key,
    adset_key: r.adset_key,
    ad_key: r.ad_key,
    leads_total: Number(r.leads_total || 0),
    leads_atendidos: Number(r.leads_atendidos || 0),
    leads_qualificados: Number(r.leads_qualificados || 0),
    visitas_agendadas: Number(r.visitas_agendadas || 0),
    propostas_enviadas: Number(r.propostas_enviadas || 0),
    contratos_fechados: Number(r.contratos_fechados || 0),
    receita_brl: Number(r.receita_brl || 0),
    notes: r.notes,
  }));
}

export async function saveLeadQualityBatch(records: LeadQualityRecord[]): Promise<void> {
  if (records.length === 0) return;

  const rows = records.map(r => ({
    workspace_id: r.workspace_id,
    date: r.date,
    campaign_key: r.campaign_key,
    adset_key: r.adset_key || null,
    ad_key: r.ad_key || null,
    leads_total: r.leads_total,
    leads_atendidos: r.leads_atendidos,
    leads_qualificados: r.leads_qualificados,
    visitas_agendadas: r.visitas_agendadas,
    propostas_enviadas: r.propostas_enviadas,
    contratos_fechados: r.contratos_fechados,
    receita_brl: r.receita_brl,
    notes: r.notes || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('lead_quality').insert(rows as any);
  if (error) console.error('Error saving lead quality:', error);
}

export async function clearAllData(): Promise<void> {
  await supabase.from('meta_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('monthly_targets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('funnel_data').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
