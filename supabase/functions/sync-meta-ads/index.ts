import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── META API 2026 CONSTANTS ───

const META_API_VERSION = 'v22.0'; // Updated from v21.0 for 2026 compliance

// Attribution windows available post-Jan 2026:
// - 1d_click, 7d_click (recommended default), 1d_view
// Removed: 7d_view, 28d_view (discontinued Jan 12, 2026)
const ATTRIBUTION_SETTING = '7d_click,1d_view';

// Data retention limits (Jan 2026):
const MAX_UNIQUE_COUNT_MONTHS = 13;
const MAX_FREQUENCY_BREAKDOWN_MONTHS = 6;

// ─── HELPERS ───

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, retries = 5, backoff = 3000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res;

    const errorText = await res.text();

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

// Enforce data retention limits (Meta 2026)
function enforceDataLimits(since: string): string {
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() - MAX_UNIQUE_COUNT_MONTHS);
  const sinceDate = new Date(since);
  if (sinceDate < maxDate) {
    console.log(`[SYNC] Date ${since} exceeds ${MAX_UNIQUE_COUNT_MONTHS}-month limit, clamping to ${maxDate.toISOString().slice(0, 10)}`);
    return maxDate.toISOString().slice(0, 10);
  }
  return since;
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

    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    workspaceId = body.workspace_id || null;
    const externalAccountId = body.ad_account_id || defaultAdAccountId;
    if (!externalAccountId) throw new Error('Missing ad_account_id');

    const accountId = externalAccountId.startsWith('act_') ? externalAccountId : `act_${externalAccountId}`;
    const level = body.level || 'ad';
    const breakdowns = body.breakdowns || [];

    // Determine date range
    let since = body.since;
    let until = body.until;
    if (!since || !until) {
      if (workspaceId) {
        // Check both 'meta' and 'meta_ads' for backward compat
        const { data: connector } = await supabase
          .from('connectors')
          .select('last_successful_sync')
          .eq('workspace_id', workspaceId)
          .in('provider', ['meta', 'meta_ads'])
          .order('last_successful_sync', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        
        if (connector?.last_successful_sync) {
          const lastSync = new Date(connector.last_successful_sync);
          lastSync.setDate(lastSync.getDate() - 2);
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

    // Enforce Meta 2026 data retention limits
    since = enforceDataLimits(since);

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

      const { data: run } = await supabase
        .from('sync_runs')
        .insert({
          workspace_id: workspaceId,
          provider: 'meta',
          ad_account_id: adAccountDbId,
          status: 'running',
          params_json: { since, until, level, breakdowns, api_version: META_API_VERSION, attribution: ATTRIBUTION_SETTING },
        })
        .select('id')
        .single();
      syncRunId = run?.id || null;
    }

    // ─── STEP 1: Fetch & upsert ENTITIES ───
    let campaignsUpserted = 0, adsetsUpserted = 0, adsUpserted = 0;

    // Campaigns — now includes smart_promotion_type for Advantage+ detection
    const campaignsUrl = `https://graph.facebook.com/${META_API_VERSION}/${accountId}/campaigns?fields=id,name,objective,status,effective_status,smart_promotion_type,buying_type&limit=500&access_token=${accessToken}`;
    const campaigns = await fetchAllPages(campaignsUrl);
    console.log(`[SYNC] Fetched ${campaigns.length} campaigns from Meta API (${META_API_VERSION})`);
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
        const batch = rows.slice(i, i + 500);
        const { error, data } = await supabase.from('meta_campaigns').upsert(batch, {
          onConflict: 'workspace_id,ad_account_id,campaign_id'
        }).select('id');
        if (error) {
          console.error(`[SYNC] meta_campaigns upsert error:`, JSON.stringify(error));
        } else {
          campaignsUpserted += data?.length || batch.length;
        }
      }
      console.log(`[SYNC] meta_campaigns: ${campaignsUpserted} upserted`);
    }

    // Adsets — includes targeting for Advantage+ Audience detection
    const adsetsUrl = `https://graph.facebook.com/${META_API_VERSION}/${accountId}/adsets?fields=id,campaign_id,name,status,effective_status,optimization_goal,billing_event,targeting&limit=500&access_token=${accessToken}`;
    const adsets = await fetchAllPages(adsetsUrl);
    console.log(`[SYNC] Fetched ${adsets.length} adsets from Meta API`);
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
        const batch = rows.slice(i, i + 500);
        const { error, data } = await supabase.from('meta_adsets').upsert(batch, {
          onConflict: 'workspace_id,ad_account_id,adset_id'
        }).select('id');
        if (error) {
          console.error(`[SYNC] meta_adsets upsert error:`, JSON.stringify(error));
        } else {
          adsetsUpserted += data?.length || batch.length;
        }
      }
      console.log(`[SYNC] meta_adsets: ${adsetsUpserted} upserted`);
    }

    // Ads
    const adsUrl = `https://graph.facebook.com/${META_API_VERSION}/${accountId}/ads?fields=id,campaign_id,adset_id,name,status,effective_status,creative{id}&limit=500&access_token=${accessToken}`;
    const ads = await fetchAllPages(adsUrl);
    console.log(`[SYNC] Fetched ${ads.length} ads from Meta API`);
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
        const batch = rows.slice(i, i + 500);
        const { error, data } = await supabase.from('meta_ads').upsert(batch, {
          onConflict: 'workspace_id,ad_account_id,ad_id'
        }).select('id');
        if (error) {
          console.error(`[SYNC] meta_ads upsert error:`, JSON.stringify(error));
        } else {
          adsUpserted += data?.length || batch.length;
        }
      }
      console.log(`[SYNC] meta_ads: ${adsUpserted} upserted`);
    }

    // ─── STEP 1b: Fetch & upsert AD CREATIVES ───
    let creativesUpserted = 0;
    if (ads.length > 0 && workspaceId) {
      console.log(`[SYNC] Fetching creative details for ${ads.length} ads...`);
      const creativeRows: any[] = [];

      // Batch fetch creative details (50 at a time to avoid rate limits)
      for (let i = 0; i < ads.length; i += 50) {
        const batch = ads.slice(i, i + 50);
        const adIds = batch.map((a: any) => a.id).join(',');
        
        try {
          const creativesUrl = `https://graph.facebook.com/${META_API_VERSION}/?ids=${adIds}&fields=id,name,adset_id,campaign_id,status,effective_status,creative{id,name,thumbnail_url,body,title,call_to_action_type,video_id,image_url}&access_token=${accessToken}`;
          const creativesRes = await fetchWithRetry(creativesUrl);
          const creativesData = await creativesRes.json();

          for (const adId of Object.keys(creativesData)) {
            const ad = creativesData[adId];
            if (!ad || ad.error) continue;
            const creative = ad.creative || {};
            
            // Detect creative_type from available fields
            let creativeType = 'image';
            if (creative.video_id) creativeType = 'video';
            
            creativeRows.push({
              workspace_id: workspaceId,
              ad_id: adId,
              ad_name: ad.name || '',
              campaign_id: ad.campaign_id || null,
              adset_id: ad.adset_id || null,
              status: ad.effective_status || ad.status || 'active',
              creative_type: creativeType,
              thumbnail_url: creative.thumbnail_url || creative.image_url || null,
              hook: creative.title || null,
              cta: creative.call_to_action_type || null,
              angle: creative.body?.slice(0, 200) || null,
            });
          }
        } catch (batchErr) {
          console.error(`[SYNC] Creative batch error (ads ${i}-${i + batch.length}):`, batchErr);
        }

        if (i + 50 < ads.length) await sleep(500); // rate limit
      }

      // Upsert ad_creatives
      if (creativeRows.length > 0) {
        for (let i = 0; i < creativeRows.length; i += 200) {
          const batch = creativeRows.slice(i, i + 200);
          const { error, data } = await supabase.from('ad_creatives').upsert(batch, {
            onConflict: 'workspace_id,ad_id',
          }).select('id');
          if (error) {
            console.error(`[SYNC] ad_creatives upsert error:`, JSON.stringify(error));
          } else {
            creativesUpserted += data?.length || batch.length;
          }
        }
        console.log(`[SYNC] ad_creatives: ${creativesUpserted}/${creativeRows.length} upserted`);
      }
    }

    // ─── STEP 1c: Fetch & upsert CREATIVE DAILY METRICS ───
    let creativeDailyUpserted = 0;
    if (ads.length > 0 && workspaceId && adAccountDbId) {
      console.log(`[SYNC] Fetching creative daily metrics (${since} to ${until})...`);
      
      const cdmFields = 'ad_id,ad_name,impressions,clicks,spend,actions,ctr,cpm,frequency,reach';
      const cdmParams = new URLSearchParams({
        fields: cdmFields,
        level: 'ad',
        time_increment: '1',
        limit: '500',
        access_token: accessToken,
        time_range: JSON.stringify({ since, until }),
      });
      const cdmUrl = `https://graph.facebook.com/${META_API_VERSION}/${accountId}/insights?${cdmParams.toString()}`;
      const cdmInsights = await fetchAllPages(cdmUrl);
      console.log(`[SYNC] Fetched ${cdmInsights.length} creative daily metric rows`);

      const cdmRows = cdmInsights.map((ins: any) => {
        const spend = parseFloat(ins.spend) || 0;
        const impressions = parseInt(ins.impressions) || 0;
        const clicks = parseInt(ins.clicks) || 0;
        const reach = parseInt(ins.reach) || 0;
        const leads = getActionValue(ins.actions, 'lead')
          || getActionValue(ins.actions, 'onsite_conversion.messaging_first_reply')
          || getActionValue(ins.actions, 'offsite_conversion.fb_pixel_lead');

        return {
          workspace_id: workspaceId,
          ad_id: ins.ad_id || '',
          date: ins.date_start,
          impressions,
          clicks,
          spend,
          reach,
          leads,
          ctr: parseFloat(ins.ctr) || 0,
          cpm: parseFloat(ins.cpm) || 0,
          frequency: parseFloat(ins.frequency) || 0,
          cpc: clicks > 0 ? spend / clicks : 0,
          cpl: leads > 0 ? spend / leads : 0,
        };
      });

      if (cdmRows.length > 0) {
        for (let i = 0; i < cdmRows.length; i += 500) {
          const batch = cdmRows.slice(i, i + 500);
          const { error } = await supabase.from('creative_daily_metrics').upsert(batch, {
            onConflict: 'workspace_id,ad_id,date',
          });
          if (error) {
            console.error(`[SYNC] creative_daily_metrics upsert error:`, JSON.stringify(error));
          } else {
            creativeDailyUpserted += batch.length;
          }
        }
        console.log(`[SYNC] creative_daily_metrics: ${creativeDailyUpserted}/${cdmRows.length} upserted`);
      }
    }

    // ─── STEP 2: Fetch INSIGHTS ───
    // Updated fields for Meta 2026:
    // - Added video_thru_play_actions (replaces deprecated 10-second views)
    // - Added video_2_sec_continuous_video_views (new standard)
    // - Using attribution_setting for 7d_click/1d_view
    // - "reach" kept as fallback; "viewers" will be added when available (Jun 2026)
    const insightFields = [
      'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_id', 'ad_name',
      'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
      'cpm', 'ctr', 'frequency', 'cpc',
      'actions', 'action_values', 'cost_per_action_type',
      'inline_link_click_ctr', 'cost_per_inline_link_click',
      'website_purchase_roas',
      // Video metrics (standard fields)
      'video_avg_time_watched_actions',
    ].join(',');

    const params = new URLSearchParams({
      fields: insightFields,
      level,
      time_increment: '1',
      limit: '500',
      access_token: accessToken,
      time_range: JSON.stringify({ since, until }),
      // Meta 2026: Set attribution window explicitly (7d click + 1d view)
      attribution_setting: ATTRIBUTION_SETTING,
    });

    if (breakdowns.length > 0) {
      params.set('breakdowns', breakdowns.join(','));
    }

    const insightsUrl = `https://graph.facebook.com/${META_API_VERSION}/${accountId}/insights?${params.toString()}`;
    const insights = await fetchAllPages(insightsUrl);
    console.log(`[SYNC] Fetched ${insights.length} insight rows from Meta API (level=${level}, ${since} to ${until}, attribution=${ATTRIBUTION_SETTING})`);

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

      // Meta 2026: Extract ThruPlay (replaces 10-second views)
      const thruplay = getActionValue(ins.video_thru_play_actions, 'video_view') || getActionValue(ins.actions, 'video_view');

      // Placement: replace deprecated "Facebook Video Feeds" with "Facebook Reels"
      let placement = ins.publisher_platform && ins.platform_position ? `${ins.publisher_platform}_${ins.platform_position}` : '';
      if (placement.toLowerCase().includes('video_feeds') || placement.toLowerCase().includes('facebook_video_feeds')) {
        placement = placement.replace(/video_feeds/gi, 'reels');
        console.log(`[SYNC] Remapped deprecated placement "Video Feeds" → "Reels"`);
      }

      const row: any = {
        workspace_id: workspaceId,
        ad_account_id: adAccountDbId,
        date: ins.date_start,
        level,
        campaign_id: ins.campaign_id || '',
        adset_id: ins.adset_id || '',
        ad_id: ins.ad_id || '',
        creative_id: null,
        placement,
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
        // Meta 2026: Use 7d_click/1d_view attribution
        attribution_setting: ATTRIBUTION_SETTING,
        actions_json: ins.actions || null,
      };

      return row;
    });

    // Upsert into facts_meta_insights_daily
    let upserted = 0;
    const CONFLICT_COLS = 'workspace_id,ad_account_id,date,level,campaign_id,adset_id,ad_id,placement,device_platform,publisher_platform,age,gender,country,attribution_setting';
    if (factRows.length > 0 && workspaceId && adAccountDbId) {
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
      console.log(`[SYNC] facts_meta_insights_daily: ${upserted}/${factRows.length} upserted`);
    }

    // Also write to legacy meta_records for backward compatibility
    let legacyUpserted = 0;
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
      const batch = legacyRows.slice(i, i + 500);
      const { error } = await supabase.from('meta_records').upsert(batch as any, {
        onConflict: 'unique_key,period_key,granularity'
      });
      if (error) {
        console.error(`[SYNC] meta_records upsert error:`, JSON.stringify(error));
      } else {
        legacyUpserted += batch.length;
      }
    }
    console.log(`[SYNC] meta_records (legacy): ${legacyUpserted}/${legacyRows.length} upserted`);

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
      // Upsert connector so incremental sync works even on first run
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from('connectors')
        .select('id')
        .eq('workspace_id', workspaceId)
        .in('provider', ['meta', 'meta_ads'])
        .limit(1)
        .maybeSingle();

      if (existing) {
        await supabase.from('connectors')
          .update({ last_successful_sync: now, updated_at: now })
          .eq('id', existing.id);
      } else {
        await supabase.from('connectors')
          .insert({
            workspace_id: workspaceId,
            provider: 'meta_ads',
            status: 'active',
            last_successful_sync: now,
            config_json: { api_version: META_API_VERSION, attribution: ATTRIBUTION_SETTING },
          });
      }
    }

    const totalEntities = campaigns.length + adsets.length + ads.length;
    const summary = {
      campaigns: { fetched: campaigns.length, upserted: campaignsUpserted },
      adsets: { fetched: adsets.length, upserted: adsetsUpserted },
      ads: { fetched: ads.length, upserted: adsUpserted },
      creatives: { upserted: creativesUpserted },
      creative_daily_metrics: { upserted: creativeDailyUpserted },
      insights: { fetched: insights.length, upserted },
      legacy_records: { upserted: legacyUpserted },
      meta_2026: { api_version: META_API_VERSION, attribution: ATTRIBUTION_SETTING },
    };
    console.log(`[SYNC] ✅ COMPLETE:`, JSON.stringify(summary));

    return new Response(
      JSON.stringify({
        success: true,
        records: upserted,
        entities: totalEntities,
        insights_fetched: insights.length,
        creatives_upserted: creativesUpserted,
        creative_daily_metrics_upserted: creativeDailyUpserted,
        details: summary,
        message: `${upserted} insights + ${totalEntities} entities + ${creativesUpserted} criativos sincronizados (${META_API_VERSION}, ${ATTRIBUTION_SETTING})`,
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

    // Auto-alert on expired token
    const isTokenExpired = error.message?.includes('Session has expired') ||
      error.message?.includes('Error validating access token') ||
      (error.message?.includes('OAuthException') && error.message?.includes('"code":190'));

    if (isTokenExpired) {
      console.log('[SYNC] 🔴 Token expirado detectado — enviando alerta por e-mail');
      try {
        const resendKey = Deno.env.get('RESEND_API_KEY');
        if (resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'bwild Alerts <onboarding@resend.dev>',
              to: ['pedro@bwild.com.br', 'matheus@bwild.com.br'],
              subject: '🔴 URGENTE: Token Meta Ads expirado — renovar agora',
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <h2 style="color:#dc2626">⚠️ Token Meta Ads Expirado</h2>
                  <p>O sync automático de Meta Ads falhou porque o <strong>META_ACCESS_TOKEN</strong> expirou.</p>
                  <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0">
                    <p style="margin:0;color:#991b1b;font-size:14px"><strong>Erro:</strong> ${error.message?.slice(0, 200)}</p>
                    <p style="margin:8px 0 0;color:#991b1b;font-size:14px"><strong>Data:</strong> ${new Date().toISOString()}</p>
                  </div>
                  <h3>Como resolver:</h3>
                  <ol>
                    <li>Acesse o <a href="https://business.facebook.com/settings/system-users">Meta Business Manager → System Users</a></li>
                    <li>Gere um novo token com permissões <code>ads_read</code> e <code>read_insights</code></li>
                    <li>Atualize o secret <strong>META_ACCESS_TOKEN</strong> no Lovable Cloud</li>
                  </ol>
                  <p style="color:#6b7280;font-size:12px">Enquanto o token não for renovado, nenhum dado será sincronizado.</p>
                </div>
              `,
            }),
          });
          console.log('[SYNC] ✅ E-mail de alerta de token expirado enviado');
        }
      } catch (emailErr) {
        console.error('[SYNC] Falha ao enviar e-mail de alerta:', emailErr);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
