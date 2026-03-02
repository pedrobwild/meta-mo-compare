import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: workspaces } = await sb.from("workspaces").select("id");
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ message: "No workspaces" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    let totalSnapshots = 0;

    for (const ws of workspaces) {
      const wid = ws.id;

      const { data: leads } = await sb
        .from("funnel_leads")
        .select("*")
        .eq("workspace_id", wid);

      if (!leads?.length) continue;

      // Group by source
      const bySource: Record<string, any[]> = { all: leads };
      for (const l of leads) {
        const src = l.source || 'unknown';
        (bySource[src] ??= []).push(l);
      }

      // Group by campaign
      const byCampaign: Record<string, any[]> = {};
      for (const l of leads) {
        if (l.campaign_id) {
          (byCampaign[l.campaign_id] ??= []).push(l);
        }
      }

      const calcSnapshot = (group: any[], source: string, campaignId: string | null) => {
        const total = group.length;
        const contacted = group.filter((l: any) => l.contact_attempts > 0 || ['contacted', 'mql', 'sql', 'scheduled', 'closed_won', 'closed_lost'].includes(l.stage)).length;
        const mqls = group.filter((l: any) => l.is_mql).length;
        const sqls = group.filter((l: any) => l.is_sql).length;
        const scheduled = group.filter((l: any) => ['scheduled', 'closed_won', 'closed_lost'].includes(l.stage)).length;
        const closedWon = group.filter((l: any) => l.stage === 'closed_won').length;
        const closedLost = group.filter((l: any) => l.stage === 'closed_lost').length;
        const revenue = group.reduce((s: number, l: any) => s + (l.stage === 'closed_won' ? Number(l.deal_value || 0) : 0), 0);

        const contactTimes = group
          .filter((l: any) => l.time_to_first_contact_minutes != null)
          .map((l: any) => Number(l.time_to_first_contact_minutes));
        const avgContactTime = contactTimes.length > 0 ? contactTimes.reduce((a: number, b: number) => a + b, 0) / contactTimes.length : 0;

        return {
          workspace_id: wid,
          date: today,
          source,
          campaign_id: campaignId,
          total_leads: total,
          contacted,
          mql_count: mqls,
          sql_count: sqls,
          scheduled,
          closed_won: closedWon,
          closed_lost: closedLost,
          contact_rate_pct: total > 0 ? (contacted / total) * 100 : 0,
          mql_rate_pct: total > 0 ? (mqls / total) * 100 : 0,
          sql_rate_pct: mqls > 0 ? (sqls / mqls) * 100 : 0,
          close_rate_pct: scheduled > 0 ? (closedWon / scheduled) * 100 : 0,
          avg_time_to_contact_minutes: avgContactTime,
          total_revenue: revenue,
          cost_per_mql: 0, // Would need spend data
          cost_per_sql: 0,
          roas_real: 0,
        };
      };

      // Insert snapshots
      for (const [source, group] of Object.entries(bySource)) {
        const snap = calcSnapshot(group, source, null);
        await sb.from("funnel_daily_snapshot").upsert(snap, {
          onConflict: "workspace_id,date,source,campaign_id",
        });
        totalSnapshots++;
      }

      for (const [campaignId, group] of Object.entries(byCampaign)) {
        const snap = calcSnapshot(group, 'campaign', campaignId);
        await sb.from("funnel_daily_snapshot").upsert(snap, {
          onConflict: "workspace_id,date,source,campaign_id",
        });
        totalSnapshots++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, snapshots: totalSnapshots }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-funnel-snapshot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
