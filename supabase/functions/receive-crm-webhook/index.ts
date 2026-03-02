import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { lead_id, new_stage, deal_value, lost_reason, notes, timestamp, workspace_id } = body;

    if (!lead_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "lead_id and workspace_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the lead
    const { data: lead, error: findErr } = await sb
      .from("funnel_leads")
      .select("*")
      .eq("workspace_id", workspace_id)
      .eq("lead_id", lead_id)
      .maybeSingle();

    if (findErr) throw findErr;

    if (!lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
    const updates: Record<string, any> = { stage_updated_at: now };

    if (new_stage) {
      // Record stage history
      const prevStageTime = lead.stage_updated_at 
        ? (new Date(now).getTime() - new Date(lead.stage_updated_at).getTime()) / 3600000 
        : 0;

      await sb.from("funnel_stage_history").insert({
        workspace_id,
        lead_id: lead.id,
        from_stage: lead.stage,
        to_stage: new_stage,
        changed_at: now,
        notes: notes || null,
        time_in_previous_stage_hours: Math.round(prevStageTime * 100) / 100,
      });

      updates.stage = new_stage;
      if (['mql', 'sql', 'scheduled', 'closed_won'].includes(new_stage)) {
        updates.is_mql = ['mql', 'sql', 'scheduled', 'closed_won'].includes(new_stage);
      }
      if (['sql', 'scheduled', 'closed_won'].includes(new_stage)) {
        updates.is_sql = true;
      }
    }

    if (deal_value !== undefined) updates.deal_value = deal_value;
    if (lost_reason) {
      updates.lost_reason = lost_reason;
      if (!new_stage) updates.stage = 'closed_lost';
    }
    if (notes) updates.qualification_notes = notes;

    const { error: updateErr } = await sb
      .from("funnel_leads")
      .update(updates)
      .eq("id", lead.id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, lead_id: lead.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("receive-crm-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
