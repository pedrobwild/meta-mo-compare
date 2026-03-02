import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── HELPERS ───

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, retries = 5, backoff = 3000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res;

    const errorText = await res.text();

    // Retry on rate-limit, server errors, or Meta transient errors (code 2)
    const isRetryable = res.status === 429 || res.status >= 500 ||
      (res.status === 400 && (errorText.includes('"code":2') || errorText.includes('temporarily unavailable')));

    if (isRetryable && i < retries - 1) {
      const wait = backoff * Math.pow(2, i);
      console.log(`Retryable error (${res.status}), attempt ${i + 1}/${retries}, retrying in ${wait}ms...`);
      await sleep(wait);
      continue;
    }

    throw new Error(`Meta API error: ${res.status} - ${errorText}`);
  }
  throw new Error('Max retries exceeded');
}

async function fetchAllPages(url: string): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = url;
  while (nextUrl) {
    const res = await fetchWithRetry(nextUrl);
    const json = await res.json();
    if (json.data) allData.push(...json.data);
    nextUrl = json.paging?.next || null;
  }
  return allData;
}

function getActionValue(actions: any[] | undefined, type: string): number {
  if (!actions) return 0;
  const a = actions.find((x: any) => x.action_type === type);
  return a ? parseFloat(a.value) || 0 : 0;
}

function getActionValues(actions: any[] | undefined): Record<string, number> {
  if (!actions) return {};
  const map: Record<string, number> = {};
  for (const a of actions) { map[a.action_type] = parseFloat(a.value) || 0; }
  return map;
}

// ─── MAIN ───

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let syncRunId: string | null = null;
  let workspaceId: string | null = null;
  let adAccountDbId: string | null = null;

  try {
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    const defaultAdAccountId = Deno.env.get('META_AD_ACCOUNT_ID');

    if (!accessToken) throw new Error('Missing META_ACCESS_TOKEN');

    // Parse request body
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    workspaceId = body.workspace_id || null;
    const externalAccountId = body.ad_account_id || defaultAdAccountId;
    if (!externalAccountId) throw new Error('Missing ad_account_id');

    const accountId = externalAccountId.startsWith('act_') ? externalAccountId : `act_${externalAccountId}`;
    const level = body.level || 'ad'; // campaign | adset | ad
    const breakdowns = body.breakdowns || []; // ['publisher_platform', 'device_platform']

    // Determine date range
    let since = body.since;
    let until = body.until;
    if (!since || !until) {
      // Incremental: check last sync
      if (workspaceId) {
        const { data: connector } = await supabase
          .from('connectors')
          .select('last_successful_sync')
          .eq('workspace_id', workspaceId)
          .eq('provider', 'meta')
          .maybeSingle();
        
        if (connector?.last_successful_sync) {
          const lastSync = new Date(connector.last_successful_sync);
          lastSync.setDate(lastSync.getDate() - 2); // 2-day buffer
          since = lastSync.toISOString().slice(0, 10);
        }
      }
      if (!since) {
        const d = new Date();
        d.setDate(d.getDate() - (body.days || 30));
        since = d.toISOString().slice(0, 10);
      }
      if (!until) {
        until = new Date().toISOString().slice(0, 10);
      }
    }

    // Ensure ad_account exists in DB if workspace provided
    if (workspaceId) {
      const cleanId = externalAccountId.replace(/^act_/, '');
      const { data: existingAcc } = await supabase
        .from('ad_accounts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('external_account_id', cleanId)
        .maybeSingle();

      if (existingAcc) {
        adAccountDbId = existingAcc.id;
      } else {
        const { data: newAcc } = await supabase
          .from('ad_accounts')
          .insert({ workspace_id: workspaceId, provider: 'meta', external_account_id: cleanId, name: accountId })
          .select('id')
          .single();
        adAccountDbId = newAcc?.id || null;
      }

      // Create sync_run
      const { data: run } = await supabase
        .from('sync_runs')
        .insert({
          workspace_id: workspaceId,
          provider: 'meta',
          ad_account_id: adAccountDbId,
          status: 'running',
          params_json: { since, until, level, breakdowns },
        })
        .select('id')
        .single();
      syncRunId = run?.id || null;
    }

    // ─── STEP 1: Fetch & upsert ENTITIES ───

    // Campaigns
    const campaignsUrl = `https://graph.facebook.com/v21.0/${accountId}/campaigns?fields=id,name,objective,status,effective_status&limit=500&access_token=${accessToken}`;
    const campaigns = await fetchAllPages(campaignsUrl);
    if (campaigns.length > 0 && workspaceId && adAccountDbId) {
      const rows = campaigns.map((c: any) => ({
        workspace_id: workspaceId,
        ad_account_id: adAccountDbId,
        campaign_id: c.id,
        name: c.name || '',
        objective: c.objective || null,
        status: c.status || null,
        effective_status: c.effective_status || null,
        updated_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('meta_campaigns').upsert(rows.slice(i, i + 500), {
          onConflict: 'workspace_id,ad_account_id,campaign_id'
        });
      }
    }

    // Adsets
    const adsetsUrl = `https://graph.facebook.com/v21.0/${accountId}/adsets?fields=id,campaign_id,name,status,effective_status,optimization_goal,billing_event&limit=500&access_token=${accessToken}`;
    const adsets = await fetchAllPages(adsetsUrl);
    if (adsets.length > 0 && workspaceId && adAccountDbId) {
      const rows = adsets.map((a: any) => ({
        workspace_id: workspaceId,
        ad_account_id: adAccountDbId,
        adset_id: a.id,
        campaign_id: a.campaign_id || '',
        name: a.name || '',
        status: a.status || null,
        effective_status: a.effective_status || null,
        optimization_goal: a.optimization_goal || null,
        billing_event: a.billing_event || null,
        updated_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('meta_adsets').upsert(rows.slice(i, i + 500), {
          onConflict: 'workspace_id,ad_account_id,adset_id'
        });
      }
    }

    // Ads
    const adsUrl = `https://graph.facebook.com/v21.0/${accountId}/ads?fields=id,campaign_id,adset_id,name,status,effective_status,creative{id}&limit=500&access_token=${accessToken}`;
    const ads = await fetchAllPages(adsUrl);
    if (ads.length > 0 && workspaceId && adAccountDbId) {
      const rows = ads.map((a: any) => ({
        workspace_id: workspaceId,
        ad_account_id: adAccountDbId,
        ad_id: a.id,
        adset_id: a.adset_id || '',
        campaign_id: a.campaign_id || '',
        name: a.name || '',
        status: a.status || null,
        effective_status: a.effective_status || null,
        creative_id: a.creative?.id || null,
        updated_at: new Date().toISOString(),
      }));
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('meta_ads').upsert(rows.slice(i, i + 500), {
          onConflict: 'workspace_id,ad_account_id,ad_id'
        });
      }
    }

    // ─── STEP 2: Fetch INSIGHTS ───

    const insightFields = [
      'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name',
      'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
      'cpm', 'ctr', 'frequency', 'cpc',
      'actions', 'action_values', 'cost_per_action_type',
      'inline_link_click_ctr', 'cost_per_inline_link_click',
      'website_purchase_roas',
    ].join(',');

    const params = new URLSearchParams({
      fields: insightFields,
      level,
      time_increment: '1',
      limit: '500',
      access_token: accessToken,
      time_range: JSON.stringify({ since, until }),
    });

    if (breakdowns.length > 0) {
      params.set('breakdowns', breakdowns.join(','));
    }

    const insightsUrl = `https://graph.facebook.com/v21.0/${accountId}/insights?${params.toString()}`;
    const insights = await fetchAllPages(insightsUrl);

    // ─── STEP 3: Transform & Upsert ───

    const factRows = insights.map((ins: any) => {
      const spend = parseFloat(ins.spend) || 0;
      const impressions = parseInt(ins.impressions) || 0;
      const reach = parseInt(ins.reach) || 0;
      const clicks = parseInt(ins.clicks) || 0;
      const inlineLinkClicks = parseInt(ins.inline_link_clicks) || 0;
      const lpv = getActionValue(ins.actions, 'landing_page_view');
      const resultsLeads = getActionValue(ins.actions, 'lead')
        || getActionValue(ins.actions, 'onsite_conversion.messaging_first_reply')
        || getActionValue(ins.actions, 'offsite_conversion.fb_pixel_lead');
      const purchases = getActionValue(ins.actions, 'purchase') || getActionValue(ins.actions, 'offsite_conversion.fb_pixel_purchase');
      const purchaseValue = getActionValue(ins.action_values, 'purchase') || getActionValue(ins.action_values, 'offsite_conversion.fb_pixel_purchase');
      const addToCart = getActionValue(ins.actions, 'add_to_cart') || getActionValue(ins.actions, 'offsite_conversion.fb_pixel_add_to_cart');
      const initiateCheckout = getActionValue(ins.actions, 'initiate_checkout') || getActionValue(ins.actions, 'offsite_conversion.fb_pixel_initiate_checkout');

      const row: any = {
        workspace_id: workspaceId,
        ad_account_id: adAccountDbId,
        date: ins.date_start,
        level,
        campaign_id: ins.campaign_id || '',
        adset_id: ins.adset_id || '',
        ad_id: ins.ad_id || '',
        creative_id: null,
        placement: ins.publisher_platform && ins.platform_position ? `${ins.publisher_platform}_${ins.platform_position}` : '',
        device_platform: ins.device_platform || '',
        publisher_platform: ins.publisher_platform || '',
        age: ins.age || '',
        gender: ins.gender || '',
        country: ins.country || '',
        spend,
        impressions,
        reach,
        clicks,
        inline_link_clicks: inlineLinkClicks,
        landing_page_views: lpv,
        results_leads: resultsLeads,
        purchases,
        purchase_value: purchaseValue,
        add_to_cart: addToCart,
        initiate_checkout: initiateCheckout,
        ctr_link: impressions > 0 ? (inlineLinkClicks / impressions) * 100 : null,
        cpc_link: inlineLinkClicks > 0 ? spend / inlineLinkClicks : null,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
        frequency: reach > 0 ? impressions / reach : null,
        cpa_lead: resultsLeads > 0 ? spend / resultsLeads : null,
        roas: spend > 0 && purchaseValue > 0 ? purchaseValue / spend : null,
        attribution_setting: '',
        actions_json: ins.actions || null,
      };

      return row;
    });

    // Upsert into facts_meta_insights_daily
    let upserted = 0;
    const CONFLICT_COLS = 'workspace_id,ad_account_id,date,level,campaign_id,adset_id,ad_id,placement,device_platform,publisher_platform,age,gender,country,attribution_setting';
    if (factRows.length > 0 && workspaceId && adAccountDbId) {
      // Ensure all breakdown columns are non-null strings
      for (const row of factRows) {
        row.campaign_id = row.campaign_id || '';
        row.adset_id = row.adset_id || '';
        row.ad_id = row.ad_id || '';
        row.placement = row.placement || '';
        row.device_platform = row.device_platform || '';
        row.publisher_platform = row.publisher_platform || '';
        row.age = row.age || '';
        row.gender = row.gender || '';
        row.country = row.country || '';
        row.attribution_setting = row.attribution_setting || '';
      }

      for (let i = 0; i < factRows.length; i += 500) {
        const batch = factRows.slice(i, i + 500);
        const { error } = await supabase
          .from('facts_meta_insights_daily')
          .upsert(batch, {
            onConflict: CONFLICT_COLS,
            ignoreDuplicates: false,
          });
        if (error) {
          console.error('Fact upsert batch error:', JSON.stringify(error));
          // Fallback: insert one by one with same conflict spec
          for (const row of batch) {
            const { error: singleErr } = await supabase
              .from('facts_meta_insights_daily')
              .upsert(row, { onConflict: CONFLICT_COLS, ignoreDuplicates: false });
            if (singleErr) {
              console.error('Single row upsert error:', JSON.stringify(singleErr));
            } else {
              upserted++;
            }
          }
        } else {
          upserted += batch.length;
        }
      }
    }

    // Also write to legacy meta_records for backward compatibility
    const legacyRows = insights.map((ins: any) => {
      const adName = ins.ad_name || '';
      const campaignName = ins.campaign_name || null;
      const adsetName = ins.adset_name || null;
      const adKey = adName.trim().toLowerCase();
      const campaignKey = campaignName ? campaignName.trim().toLowerCase() : null;
      const adsetKey = adsetName ? adsetName.trim().toLowerCase() : null;
      const sourceType = (campaignName && adsetName) ? 'type3_full' : campaignName ? 'type2_ad_campaign' : 'type1_ad_only';
      const uniqueKey = [adKey, campaignKey || '', adsetKey || '', sourceType, ''].join('|');
      const spend = parseFloat(ins.spend) || 0;
      const impressions = parseInt(ins.impressions) || 0;
      const linkClicks = parseInt(ins.inline_link_clicks) || 0;
      const resultsLeads = getActionValue(ins.actions, 'lead') || getActionValue(ins.actions, 'onsite_conversion.messaging_first_reply') || (ins.actions?.length ? parseFloat(ins.actions[0].value) || 0 : 0);
      const lpv = getActionValue(ins.actions, 'landing_page_view');

      return {
        unique_key: uniqueKey,
        workspace_id: workspaceId,
        period_start: ins.date_start,
        period_end: ins.date_stop,
        period_key: ins.date_start,
        granularity: 'day',
        month_key: ins.date_start?.slice(0, 7) || 'unknown',
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
        results: resultsLeads,
        reach: parseInt(ins.reach) || 0,
        frequency: parseFloat(ins.frequency) || 0,
        cost_per_result: resultsLeads > 0 ? spend / resultsLeads : 0,
        spend_brl: spend,
        impressions,
        cpm: parseFloat(ins.cpm) || 0,
        link_clicks: linkClicks,
        cpc_link: parseFloat(ins.cost_per_inline_link_click) || 0,
        ctr_link: parseFloat(ins.inline_link_click_ctr) || 0,
        clicks_all: parseInt(ins.clicks) || 0,
        ctr_all: parseFloat(ins.ctr) || 0,
        cpc_all: parseFloat(ins.cpc) || 0,
        landing_page_views: lpv,
        cost_per_lpv: lpv > 0 ? spend / lpv : 0,
        report_start: ins.date_start,
        report_end: ins.date_stop,
      };
    });

    for (let i = 0; i < legacyRows.length; i += 500) {
      await supabase.from('meta_records').upsert(legacyRows.slice(i, i + 500) as any, {
        onConflict: 'unique_key,period_key,granularity'
      });
    }

    // ─── STEP 4: Update sync tracking ───

    if (syncRunId) {
      await supabase.from('sync_runs').update({
        status: 'success',
        finished_at: new Date().toISOString(),
        records_fetched: insights.length,
        records_upserted: upserted,
      }).eq('id', syncRunId);
    }

    if (workspaceId) {
      await supabase.from('connectors')
        .update({ last_successful_sync: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('workspace_id', workspaceId)
        .eq('provider', 'meta');
    }

    const totalEntities = campaigns.length + adsets.length + ads.length;
    return new Response(
      JSON.stringify({
        success: true,
        records: upserted,
        entities: totalEntities,
        insights_fetched: insights.length,
        message: `${upserted} insights + ${totalEntities} entities sincronizados`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Sync error:', error);

    if (syncRunId) {
      await supabase.from('sync_runs').update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error: error.message,
      }).eq('id', syncRunId);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
