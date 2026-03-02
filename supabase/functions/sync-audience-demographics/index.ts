import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API_VERSION = 'v22.0';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, retries = 3, backoff = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    const errorText = await res.text();
    const isRetryable = res.status === 429 || res.status >= 500;
    if (isRetryable && i < retries - 1) {
      await sleep(backoff * Math.pow(2, i));
      continue;
    }
    throw new Error(`Meta API error: ${res.status} - ${errorText}`);
  }
  throw new Error('Max retries exceeded');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    const META_AD_ACCOUNT_ID = Deno.env.get('META_AD_ACCOUNT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
      throw new Error('Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get workspace
    const { data: accounts } = await supabase
      .from('ad_accounts')
      .select('id, workspace_id')
      .eq('external_account_id', META_AD_ACCOUNT_ID)
      .limit(1);

    if (!accounts?.length) throw new Error('No ad account found');
    const { workspace_id } = accounts[0];

    const baseUrl = `https://graph.facebook.com/${META_API_VERSION}/act_${META_AD_ACCOUNT_ID}/insights`;
    const fields = 'impressions,clicks,spend,actions,action_values';

    // 1. Age × Gender breakdown
    console.log('Fetching age × gender breakdowns...');
    const ageGenderUrl = `${baseUrl}?fields=${fields}&breakdowns=age,gender&date_preset=last_30d&time_increment=1&access_token=${META_ACCESS_TOKEN}&limit=500`;
    const ageGenderRes = await fetchWithRetry(ageGenderUrl);
    const ageGenderData = await ageGenderRes.json();
    
    const demoRows: any[] = [];
    for (const row of ageGenderData.data || []) {
      const leads = extractActionValue(row.actions, 'lead');
      demoRows.push({
        campaign_id: '',
        workspace_id,
        date: row.date_start,
        source: 'meta_ads',
        age_range: row.age || '',
        gender: row.gender || '',
        country: '',
        city: '',
        region: '',
        impressions: parseInt(row.impressions || '0'),
        clicks: parseInt(row.clicks || '0'),
        spend: parseFloat(row.spend || '0'),
        leads,
        mql: 0,
        sql_count: 0,
        conversions: extractActionValue(row.actions, 'purchase'),
        revenue: extractActionValueAmount(row.action_values, 'purchase'),
      });
    }

    // 2. Region × Country breakdown
    console.log('Fetching region × country breakdowns...');
    await sleep(1000);
    const regionUrl = `${baseUrl}?fields=${fields}&breakdowns=region,country&date_preset=last_30d&time_increment=1&access_token=${META_ACCESS_TOKEN}&limit=500`;
    const regionRes = await fetchWithRetry(regionUrl);
    const regionData = await regionRes.json();

    for (const row of regionData.data || []) {
      const leads = extractActionValue(row.actions, 'lead');
      demoRows.push({
        campaign_id: '',
        workspace_id,
        date: row.date_start,
        source: 'meta_ads',
        age_range: '',
        gender: '',
        country: row.country || '',
        city: '',
        region: row.region || '',
        impressions: parseInt(row.impressions || '0'),
        clicks: parseInt(row.clicks || '0'),
        spend: parseFloat(row.spend || '0'),
        leads,
        mql: 0,
        sql_count: 0,
        conversions: extractActionValue(row.actions, 'purchase'),
        revenue: extractActionValueAmount(row.action_values, 'purchase'),
      });
    }

    // Upsert demographics
    if (demoRows.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < demoRows.length; i += batchSize) {
        const batch = demoRows.slice(i, i + batchSize);
        const { error } = await supabase.from('audience_demographics').upsert(batch, {
          onConflict: 'workspace_id,date,source,campaign_id,age_range,gender,country,city,region',
          ignoreDuplicates: false,
        });
        if (error) console.error('Demo upsert error:', error.message);
      }
      console.log(`Upserted ${demoRows.length} demographic rows`);
    }

    // 3. Device × Platform breakdown
    console.log('Fetching device × platform breakdowns...');
    await sleep(1000);
    const deviceUrl = `${baseUrl}?fields=impressions,clicks,spend,actions&breakdowns=device_platform,publisher_platform,platform_position&date_preset=last_30d&time_increment=1&access_token=${META_ACCESS_TOKEN}&limit=500`;
    const deviceRes = await fetchWithRetry(deviceUrl);
    const deviceData = await deviceRes.json();

    const deviceRows: any[] = [];
    for (const row of deviceData.data || []) {
      const leads = extractActionValue(row.actions, 'lead');
      const clicks = parseInt(row.clicks || '0');
      const impressions = parseInt(row.impressions || '0');
      const spend = parseFloat(row.spend || '0');
      deviceRows.push({
        workspace_id,
        date: row.date_start,
        device_type: row.device_platform || '',
        platform: row.publisher_platform || '',
        placement: row.platform_position || '',
        impressions,
        clicks,
        leads,
        cpl: leads > 0 ? spend / leads : 0,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      });
    }

    if (deviceRows.length > 0) {
      const batchSize = 200;
      for (let i = 0; i < deviceRows.length; i += batchSize) {
        const batch = deviceRows.slice(i, i + batchSize);
        const { error } = await supabase.from('audience_device_data').upsert(batch, {
          onConflict: 'workspace_id,date,device_type,platform,placement',
          ignoreDuplicates: false,
        });
        if (error) console.error('Device upsert error:', error.message);
      }
      console.log(`Upserted ${deviceRows.length} device rows`);
    }

    return new Response(JSON.stringify({
      success: true,
      demographics: demoRows.length,
      devices: deviceRows.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('sync-audience-demographics error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractActionValue(actions: any[] | null, type: string): number {
  if (!actions) return 0;
  const action = actions.find((a: any) => a.action_type === type);
  return action ? parseInt(action.value || '0') : 0;
}

function extractActionValueAmount(actionValues: any[] | null, type: string): number {
  if (!actionValues) return 0;
  const action = actionValues.find((a: any) => a.action_type === type);
  return action ? parseFloat(action.value || '0') : 0;
}
