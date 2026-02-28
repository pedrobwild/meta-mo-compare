import { supabase } from '@/integrations/supabase/client';
import type { MetaRecord, MonthlyTargets, FunnelData, SourceType } from './types';

// Load all records from database
export async function loadRecords(): Promise<MetaRecord[]> {
  const { data, error } = await supabase
    .from('meta_records')
    .select('*')
    .order('month_key', { ascending: false });

  if (error) {
    console.error('Error loading records:', error);
    return [];
  }

  return (data || []).map((r: any) => ({
    unique_key: r.unique_key,
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

// Save records to database (upsert by unique_key + month_key)
export async function saveRecords(records: MetaRecord[]): Promise<void> {
  if (records.length === 0) return;

  const rows = records.map(r => ({
    unique_key: r.unique_key,
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

  // Upsert in batches of 500
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from('meta_records')
      .upsert(batch as any, { onConflict: 'unique_key,month_key' });
    if (error) console.error('Error saving records batch:', error);
  }
}

// Load targets
export async function loadTargets(): Promise<MonthlyTargets[]> {
  const { data, error } = await supabase
    .from('monthly_targets')
    .select('*');

  if (error) {
    console.error('Error loading targets:', error);
    return [];
  }

  return (data || []).map((t: any) => ({
    month_key: t.month_key,
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

// Save a single target
export async function saveTarget(target: MonthlyTargets): Promise<void> {
  const row = {
    month_key: target.month_key,
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

// Load funnel data
export async function loadFunnelData(): Promise<FunnelData[]> {
  const { data, error } = await supabase
    .from('funnel_data')
    .select('*');

  if (error) {
    console.error('Error loading funnel data:', error);
    return [];
  }

  return (data || []).map((f: any) => ({
    month_key: f.month_key,
    mql: Number(f.mql),
    sql: Number(f.sql_count),
    vendas: Number(f.vendas),
    receita: Number(f.receita),
  }));
}

// Save funnel data
export async function saveFunnel(funnel: FunnelData): Promise<void> {
  const row = {
    month_key: funnel.month_key,
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

// Delete all data
export async function clearAllData(): Promise<void> {
  await supabase.from('meta_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('monthly_targets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('funnel_data').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
