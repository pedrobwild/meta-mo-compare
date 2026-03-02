import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Get all workspaces
    const { data: workspaces } = await sb.from("workspaces").select("id");
    if (!workspaces?.length) {
      return new Response(JSON.stringify({ message: "No workspaces" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalClassified = 0;

    for (const ws of workspaces) {
      const workspaceId = ws.id;

      // Get active creatives
      const { data: creatives } = await sb
        .from("ad_creatives")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("status", ["active", "ACTIVE"]);

      if (!creatives?.length) continue;

      for (const creative of creatives) {
        // Get daily metrics for this creative (last 14 days)
        const { data: metrics } = await sb
          .from("creative_daily_metrics")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("ad_id", creative.ad_id)
          .order("date", { ascending: true });

        if (!metrics?.length) continue;

        const daysActive = metrics.length;
        const firstSeen = metrics[0].date;

        // Calculate averages
        const last3 = metrics.slice(-3);
        const last7 = metrics.slice(-7);
        const first3 = metrics.slice(0, 3);

        const avgCtrLast3 = last3.reduce((s: number, m: any) => s + Number(m.ctr || 0), 0) / last3.length;
        const avgCtrLast7 = last7.reduce((s: number, m: any) => s + Number(m.ctr || 0), 0) / last7.length;
        const avgCtrFirst3 = first3.reduce((s: number, m: any) => s + Number(m.ctr || 0), 0) / first3.length;
        const avgCplLast3 = last3.reduce((s: number, m: any) => s + Number(m.cpl || 0), 0) / last3.length;
        const avgCplLast7 = last7.reduce((s: number, m: any) => s + Number(m.cpl || 0), 0) / last7.length;
        const avgFreqLast7 = last7.reduce((s: number, m: any) => s + Number(m.frequency || 0), 0) / last7.length;

        // Check for 3 consecutive days of low CTR or high CPL
        const ctrBelow1For3Days = last3.length >= 3 && last3.every((m: any) => Number(m.ctr || 0) < 1.0);
        
        // Get account average CPL as reference (from all creatives in workspace)
        const { data: allMetrics } = await sb
          .from("creative_daily_metrics")
          .select("cpl")
          .eq("workspace_id", workspaceId)
          .gt("cpl", 0);
        
        const accountAvgCpl = allMetrics?.length 
          ? allMetrics.reduce((s: number, m: any) => s + Number(m.cpl || 0), 0) / allMetrics.length 
          : 0;
        
        const cplMeta = accountAvgCpl || avgCplLast7;
        const cplHighFor3Days = last3.length >= 3 && cplMeta > 0 && last3.every((m: any) => Number(m.cpl || 0) > cplMeta * 1.5);

        // Classify lifecycle stage
        let stage = "fresh";

        if (daysActive <= 3) {
          stage = "fresh";
        } else if (
          avgFreqLast7 > 3.5 ||
          ctrBelow1For3Days ||
          cplHighFor3Days
        ) {
          stage = "fatigued";
        } else if (
          daysActive > 7 && (
            avgCtrLast3 < avgCtrLast7 * 0.80 ||
            (avgCplLast7 > 0 && avgCplLast3 > avgCplLast7 * 1.20)
          )
        ) {
          stage = "declining";
        } else if (
          daysActive > 3 &&
          avgCtrLast3 >= 1.2 &&
          (cplMeta <= 0 || avgCplLast3 <= cplMeta) &&
          avgFreqLast7 <= 2.5
        ) {
          stage = "peaking";
        } else if (daysActive > 3) {
          // Default for > 3 days that don't match other criteria
          stage = avgCtrLast3 >= avgCtrFirst3 * 0.85 ? "peaking" : "declining";
        }

        // Calculate degradation
        const peakCtr = Math.max(...metrics.map((m: any) => Number(m.ctr || 0)));
        const degradation = peakCtr > 0 
          ? Math.max(0, ((peakCtr - avgCtrLast3) / peakCtr) * 100) 
          : 0;

        // Update creative
        await sb
          .from("ad_creatives")
          .update({
            lifecycle_stage: stage,
            lifecycle_updated_at: new Date().toISOString(),
            first_seen_at: creative.first_seen_at || firstSeen,
          })
          .eq("id", creative.id);

        totalClassified++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, classified: totalClassified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("classify-creative-lifecycle error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
