import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Fetch all active rules
    const { data: rules, error: rulesErr } = await sb
      .from('alert_rules')
      .select('*')
      .eq('enabled', true);

    if (rulesErr) throw rulesErr;
    if (!rules?.length) {
      return new Response(JSON.stringify({ checked: 0, fired: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group rules by workspace
    const workspaceIds = [...new Set(rules.map(r => r.workspace_id))];
    let totalFired = 0;

    for (const wsId of workspaceIds) {
      const wsRules = rules.filter(r => r.workspace_id === wsId);

      // Get latest insights (last 7 days aggregated)
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const yesterdayEnd = new Date(today);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      const twoWeeksAgo = new Date(weekAgo);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);

      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      // Current period
      const { data: currentData } = await sb
        .from('facts_meta_insights_daily')
        .select('campaign_id, adset_id, ad_id, spend, impressions, inline_link_clicks, landing_page_views, results_leads, reach, clicks, ctr_link, cpc_link, cpm, cpa_lead, roas, frequency')
        .eq('workspace_id', wsId)
        .gte('date', fmt(weekAgo))
        .lte('date', fmt(today));

      // Previous period
      const { data: prevData } = await sb
        .from('facts_meta_insights_daily')
        .select('campaign_id, spend, impressions, inline_link_clicks, results_leads, ctr_link, cpm, cpa_lead, roas')
        .eq('workspace_id', wsId)
        .gte('date', fmt(twoWeeksAgo))
        .lt('date', fmt(weekAgo));

      if (!currentData?.length) continue;

      // Aggregate account-level metrics
      const agg = (rows: any[]) => {
        const spend = rows.reduce((s, r) => s + (r.spend || 0), 0);
        const impressions = rows.reduce((s, r) => s + (r.impressions || 0), 0);
        const clicks = rows.reduce((s, r) => s + (r.inline_link_clicks || 0), 0);
        const results = rows.reduce((s, r) => s + (r.results_leads || 0), 0);
        const reach = rows.reduce((s, r) => s + (r.reach || 0), 0);
        const lpv = rows.reduce((s, r) => s + (r.landing_page_views || 0), 0);
        return {
          spend,
          impressions,
          roas: spend > 0 ? rows.reduce((s, r) => s + (r.roas || 0) * (r.spend || 0), 0) / spend : 0,
          cpa: results > 0 ? spend / results : 0,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
          conversions: results,
          frequency: reach > 0 ? impressions / reach : 0,
        };
      };

      // Campaign-level aggregation
      const campaignGroups = new Map<string, any[]>();
      for (const row of currentData) {
        const cid = row.campaign_id || '_all';
        if (!campaignGroups.has(cid)) campaignGroups.set(cid, []);
        campaignGroups.get(cid)!.push(row);
      }

      const prevCampaignGroups = new Map<string, any[]>();
      if (prevData) {
        for (const row of prevData) {
          const cid = row.campaign_id || '_all';
          if (!prevCampaignGroups.has(cid)) prevCampaignGroups.set(cid, []);
          prevCampaignGroups.get(cid)!.push(row);
        }
      }

      const accountMetrics = agg(currentData);
      const prevAccountMetrics = prevData?.length ? agg(prevData) : null;

      for (const rule of wsRules) {
        // Determine which metrics to evaluate based on scope
        const entitiesToCheck: { key: string; name: string; current: any; prev: any }[] = [];

        if (rule.scope === 'account' || rule.scope === 'campaign') {
          if (rule.scope === 'account') {
            entitiesToCheck.push({ key: '_account', name: 'Conta', current: accountMetrics, prev: prevAccountMetrics });
          } else {
            for (const [cid, rows] of campaignGroups) {
              const prevRows = prevCampaignGroups.get(cid);
              entitiesToCheck.push({
                key: cid,
                name: cid,
                current: agg(rows),
                prev: prevRows ? agg(prevRows) : null,
              });
            }
          }
        } else {
          // Default: account level
          entitiesToCheck.push({ key: '_account', name: 'Conta', current: accountMetrics, prev: prevAccountMetrics });
        }

        // Map rule metric to aggregated metric key
        const metricMap: Record<string, string> = {
          roas: 'roas', cpa: 'cpa', cpa_lead: 'cpa', ctr: 'ctr', ctr_link: 'ctr',
          cpm: 'cpm', spend: 'spend', conversions: 'conversions', frequency: 'frequency',
          results_leads: 'conversions',
        };
        const metricKey = metricMap[rule.metric] || rule.metric;

        for (const entity of entitiesToCheck) {
          const currentValue = entity.current[metricKey];
          if (currentValue === undefined) continue;

          // Check min_spend
          if ((rule.min_spend || 0) > 0 && entity.current.spend < rule.min_spend) continue;

          let triggered = false;

          switch (rule.operator) {
            case 'gt': triggered = currentValue > rule.threshold; break;
            case 'lt': triggered = currentValue < rule.threshold; break;
            case 'gte': triggered = currentValue >= rule.threshold; break;
            case 'lte': triggered = currentValue <= rule.threshold; break;
            case 'change_gt':
            case 'change_lt':
            case 'change_pct': {
              if (!entity.prev) break;
              const prevValue = entity.prev[metricKey] || 0;
              const changePct = prevValue !== 0 ? ((currentValue - prevValue) / Math.abs(prevValue)) * 100 : 0;
              if (rule.operator === 'change_lt') {
                triggered = changePct < -Math.abs(rule.threshold);
              } else {
                triggered = Math.abs(changePct) > Math.abs(rule.threshold);
              }
              break;
            }
          }

          // Check for existing open event for this rule+entity
          const { data: existingOpen } = await sb
            .from('alert_events')
            .select('id')
            .eq('rule_id', rule.id)
            .eq('status', 'open')
            .limit(1);

          if (triggered && (!existingOpen || existingOpen.length === 0)) {
            // Fire alert
            const contextJson = {
              metric: rule.metric,
              current_value: currentValue,
              threshold: rule.threshold,
              entity: entity.name !== '_account' ? entity.name : undefined,
              severity: rule.severity,
            };

            await sb.from('alert_events').insert({
              workspace_id: wsId,
              rule_id: rule.id,
              status: 'open',
              context_json: contextJson,
            });

            totalFired++;

            // Send email if configured
            const channels = Array.isArray(rule.notification_channels_json) ? rule.notification_channels_json : [];
            if (channels.includes('email')) {
              try {
                await fetch(`${supabaseUrl}/functions/v1/send-alert-email`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    rule_name: rule.name,
                    metric_label: rule.metric,
                    current_value: currentValue,
                    threshold: rule.threshold,
                    operator: rule.operator,
                    severity: rule.severity,
                    entity_name: entity.name !== '_account' ? entity.name : '',
                    app_url: 'https://meta-mo-compare.lovable.app',
                  }),
                });
              } catch (emailErr) {
                console.error('[CHECK-RULES] Email send failed:', emailErr);
              }
            }
          } else if (!triggered && existingOpen?.length) {
            // Auto-resolve
            for (const evt of existingOpen) {
              await sb.from('alert_events').update({
                status: 'resolved',
                resolved_at: new Date().toISOString(),
              }).eq('id', evt.id);
            }
          }
        }
      }
    }

    console.log(`[CHECK-RULES] Checked ${rules.length} rules, fired ${totalFired} alerts`);

    return new Response(
      JSON.stringify({ checked: rules.length, fired: totalFired }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[CHECK-RULES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
