import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const METRICS_TO_CHECK = ['spend', 'cpm', 'ctr_link', 'cpa_lead', 'roas'];

function getSeverity(deviationPct: number): string | null {
  const abs = Math.abs(deviationPct);
  if (abs > 80) return 'critical';
  if (abs > 60) return 'high';
  if (abs > 40) return 'medium';
  if (abs > 20) return 'low';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Get all workspaces
    const { data: workspaces } = await sb.from('workspaces').select('id');
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ anomalies: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalAnomalies = 0;
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    for (const ws of workspaces) {
      // Get last 14 days of data grouped by campaign
      const fourteenAgo = new Date(today);
      fourteenAgo.setDate(fourteenAgo.getDate() - 14);

      const { data: dailyData } = await sb
        .from('facts_meta_insights_daily')
        .select('date, campaign_id, spend, impressions, inline_link_clicks, results_leads, ctr_link, cpm, cpa_lead, roas')
        .eq('workspace_id', ws.id)
        .gte('date', fmt(fourteenAgo))
        .order('date', { ascending: true });

      if (!dailyData?.length) continue;

      // Get campaign names
      const campaignIds = [...new Set(dailyData.map(r => r.campaign_id).filter(Boolean))];
      const { data: campaigns } = await sb
        .from('meta_campaigns')
        .select('campaign_id, name')
        .eq('workspace_id', ws.id)
        .in('campaign_id', campaignIds);

      const campaignNameMap = new Map<string, string>();
      campaigns?.forEach(c => campaignNameMap.set(c.campaign_id, c.name));

      // Group by campaign
      const byCampaign = new Map<string, any[]>();
      for (const row of dailyData) {
        const cid = row.campaign_id || '_all';
        if (!byCampaign.has(cid)) byCampaign.set(cid, []);
        byCampaign.get(cid)!.push(row);
      }

      // Today's date string
      const todayStr = fmt(today);
      const yesterdayStr = fmt(new Date(today.getTime() - 86400000));

      for (const [campaignId, rows] of byCampaign) {
        if (rows.length < 7) continue; // Need at least 7 days of data

        // Get today's/yesterday's row
        const latestRow = rows.find(r => r.date === todayStr) || rows.find(r => r.date === yesterdayStr);
        if (!latestRow) continue;

        // Historical rows (excluding latest)
        const historicalRows = rows.filter(r => r.date !== latestRow.date);
        if (historicalRows.length < 5) continue;

        for (const metric of METRICS_TO_CHECK) {
          const currentValue = latestRow[metric];
          if (currentValue === null || currentValue === undefined) continue;

          const historicalValues = historicalRows.map(r => r[metric]).filter(v => v !== null && v !== undefined) as number[];
          if (historicalValues.length < 5) continue;

          const mean = historicalValues.reduce((s, v) => s + v, 0) / historicalValues.length;
          if (mean === 0) continue;

          const deviationPct = ((currentValue - mean) / Math.abs(mean)) * 100;
          const severity = getSeverity(deviationPct);

          // Only insert for medium+ severity
          if (!severity || severity === 'low') continue;

          // Check if there's already an open anomaly for this entity+metric
          const { data: existing } = await sb
            .from('anomaly_events')
            .select('id')
            .eq('workspace_id', ws.id)
            .eq('entity_id', campaignId)
            .eq('metric', metric)
            .eq('status', 'open')
            .limit(1);

          if (existing?.length) continue;

          await sb.from('anomaly_events').insert({
            workspace_id: ws.id,
            entity_type: 'campaign',
            entity_id: campaignId,
            entity_name: campaignNameMap.get(campaignId) || campaignId,
            metric,
            value_current: currentValue,
            value_expected: mean,
            deviation_pct: +deviationPct.toFixed(2),
            severity,
            status: 'open',
          });

          totalAnomalies++;

          // For critical anomalies, send email
          if (severity === 'critical') {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-alert-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  rule_name: `🚨 ANOMALIA CRÍTICA: ${metric}`,
                  metric_label: metric,
                  current_value: currentValue,
                  threshold: mean,
                  operator: 'anomaly',
                  severity: 'high',
                  entity_name: campaignNameMap.get(campaignId) || campaignId,
                  app_url: 'https://meta-mo-compare.lovable.app',
                }),
              });
            } catch (e) {
              console.error('[ANOMALY] Email error:', e);
            }
          }
        }
      }
    }

    console.log(`[DETECT-ANOMALIES] Found ${totalAnomalies} new anomalies`);

    return new Response(
      JSON.stringify({ anomalies: totalAnomalies }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[DETECT-ANOMALIES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
