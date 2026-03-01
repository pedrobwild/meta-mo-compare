import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function normalize(name: string): string {
  return name.trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');
}

function detectGranularity(start: string, end: string): string {
  return start === end ? 'day' : 'week';
}

function generatePeriodKey(start: string, end: string, granularity: string): string {
  return granularity === 'day' ? start : `${start}_${end}`;
}

function extractMonthKey(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}` : 'unknown';
}

interface MetaInsight {
  ad_name: string;
  campaign_name?: string;
  adset_name?: string;
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  reach: string;
  clicks: string;
  cpc: string;
  cpm: string;
  ctr: string;
  frequency: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  inline_link_clicks?: string;
  inline_link_click_ctr?: string;
  cost_per_inline_link_click?: string;
  website_ctr?: Array<{ action_type: string; value: string }>;
  landing_page_view?: string;
  cost_per_landing_page_view?: string;
}

function getActionValue(actions: Array<{ action_type: string; value: string }> | undefined, type: string): number {
  if (!actions) return 0;
  const action = actions.find(a => a.action_type === type);
  return action ? parseFloat(action.value) || 0 : 0;
}

function getCostPerAction(costs: Array<{ action_type: string; value: string }> | undefined, type: string): number {
  if (!costs) return 0;
  const cost = costs.find(a => a.action_type === type);
  return cost ? parseFloat(cost.value) || 0 : 0;
}

async function fetchAllPages(url: string): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const res = await fetch(nextUrl);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Meta API error: ${res.status} - ${errorText}`);
    }
    const json = await res.json();
    if (json.data) allData.push(...json.data);
    nextUrl = json.paging?.next || null;
  }

  return allData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    const adAccountId = Deno.env.get('META_AD_ACCOUNT_ID');
    
    if (!accessToken || !adAccountId) {
      throw new Error('Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID');
    }

    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    // Parse optional date range from request body
    let datePreset = 'last_30d';
    let timeRange: string | null = null;
    
    try {
      const body = await req.json();
      if (body.since && body.until) {
        timeRange = JSON.stringify({ since: body.since, until: body.until });
        datePreset = '';
      } else if (body.date_preset) {
        datePreset = body.date_preset;
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    const fields = [
      'ad_name', 'campaign_name', 'adset_name',
      'spend', 'impressions', 'reach', 'clicks', 'cpc', 'cpm', 'ctr', 'frequency',
      'actions', 'cost_per_action_type',
      'inline_link_clicks', 'inline_link_click_ctr', 'cost_per_inline_link_click',
    ].join(',');

    const baseUrl = `https://graph.facebook.com/v21.0/${accountId}/insights`;
    const params = new URLSearchParams({
      fields,
      level: 'ad',
      time_increment: '1',
      limit: '500',
      access_token: accessToken,
    });

    if (timeRange) {
      params.set('time_range', timeRange);
    } else {
      params.set('date_preset', datePreset);
    }

    const url = `${baseUrl}?${params.toString()}`;
    const insights = await fetchAllPages(url);

    if (insights.length === 0) {
      return new Response(JSON.stringify({ success: true, records: 0, message: 'No data returned from Meta API' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform insights to meta_records format
    const rows = insights.map((insight: any) => {
      const adName = insight.ad_name || '';
      const campaignName = insight.campaign_name || null;
      const adsetName = insight.adset_name || null;
      const periodStart = insight.date_start;
      const periodEnd = insight.date_stop;
      const granularity = detectGranularity(periodStart, periodEnd);
      const periodKey = generatePeriodKey(periodStart, periodEnd, granularity);
      const monthKey = extractMonthKey(periodStart);

      const adKey = normalize(adName);
      const campaignKey = campaignName ? normalize(campaignName) : null;
      const adsetKey = adsetName ? normalize(adsetName) : null;

      const sourceType = (campaignName && adsetName) ? 'type3_full'
        : campaignName ? 'type2_ad_campaign' : 'type1_ad_only';

      const uniqueKey = [adKey, campaignKey || '', adsetKey || '', sourceType, ''].join('|');

      const spend = parseFloat(insight.spend) || 0;
      const impressions = parseInt(insight.impressions) || 0;
      const reach = parseInt(insight.reach) || 0;
      const linkClicks = parseInt(insight.inline_link_clicks) || 0;
      const clicksAll = parseInt(insight.clicks) || 0;
      const ctrLink = parseFloat(insight.inline_link_click_ctr) || 0;
      const cpcLink = parseFloat(insight.cost_per_inline_link_click) || 0;
      const cpm = parseFloat(insight.cpm) || 0;
      const ctrAll = parseFloat(insight.ctr) || 0;
      const cpcAll = parseFloat(insight.cpc) || 0;
      const frequency = parseFloat(insight.frequency) || 0;

      // Results (lead, or first action)
      const results = getActionValue(insight.actions, 'lead') 
        || getActionValue(insight.actions, 'onsite_conversion.messaging_first_reply')
        || getActionValue(insight.actions, 'offsite_conversion.fb_pixel_lead')
        || (insight.actions?.length ? parseFloat(insight.actions[0].value) || 0 : 0);
      
      const costPerResult = results > 0 ? spend / results : 0;

      // Landing page views
      const lpv = getActionValue(insight.actions, 'landing_page_view');
      const costPerLpv = lpv > 0 ? spend / lpv : 0;

      return {
        unique_key: uniqueKey,
        period_start: periodStart,
        period_end: periodEnd,
        period_key: periodKey,
        granularity,
        month_key: monthKey,
        ad_key: adKey,
        campaign_key: campaignKey,
        adset_key: adsetKey,
        source_type: sourceType,
        ad_name: adName,
        campaign_name: campaignName,
        adset_name: adsetName,
        delivery_status: null,
        delivery_level: null,
        result_type: null,
        results,
        reach,
        frequency,
        cost_per_result: costPerResult,
        spend_brl: spend,
        impressions,
        cpm,
        link_clicks: linkClicks,
        cpc_link: cpcLink,
        ctr_link: ctrLink,
        clicks_all: clicksAll,
        ctr_all: ctrAll,
        cpc_all: cpcAll,
        landing_page_views: lpv,
        cost_per_lpv: costPerLpv,
        report_start: periodStart,
        report_end: periodEnd,
      };
    });

    // Upsert into database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase
        .from('meta_records')
        .upsert(batch, { onConflict: 'unique_key,period_key,granularity' });
      if (error) {
        console.error('Upsert error:', error);
        throw new Error(`Database upsert error: ${error.message}`);
      }
      upserted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, records: upserted, message: `${upserted} registros sincronizados do Meta Ads` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
