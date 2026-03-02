import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── GET: Webhook verification (Meta sends a GET to verify) ───
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    const verifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'lovable_leadgen_verify';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[WEBHOOK] Verification successful');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  // ─── POST: Receive leadgen events ───
  if (req.method === 'POST') {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');

    try {
      const payload = await req.json();
      console.log('[WEBHOOK] Received:', JSON.stringify(payload).slice(0, 500));

      if (payload.object !== 'page') {
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      let leadsProcessed = 0;

      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'leadgen') continue;

          const leadgenId = change.value?.leadgen_id;
          const formId = change.value?.form_id;
          const pageId = change.value?.page_id;
          const adId = change.value?.ad_id;
          const adgroupId = change.value?.adgroup_id; // adset_id
          const createdTime = change.value?.created_time;

          if (!leadgenId || !accessToken) {
            console.log('[WEBHOOK] Missing leadgen_id or access_token, skipping');
            continue;
          }

          // Fetch full lead data from Meta API
          try {
            const leadUrl = `https://graph.facebook.com/v21.0/${leadgenId}?fields=id,created_time,field_data,campaign_id,adset_id,ad_id,is_organic,platform,form_id&access_token=${accessToken}`;
            const leadRes = await fetch(leadUrl);
            if (!leadRes.ok) {
              const errText = await leadRes.text();
              console.error(`[WEBHOOK] Failed to fetch lead ${leadgenId}:`, errText);
              continue;
            }

            const lead = await leadRes.json();
            const fieldData = lead.field_data || [];
            const fieldMap: Record<string, string> = {};
            for (const f of fieldData) {
              fieldMap[f.name] = f.values?.[0] || '';
            }

            // Find workspace from page or ad account
            // Try to find by form_id first
            const resolvedFormId = lead.form_id || formId;
            const { data: formRecord } = await supabase
              .from('meta_lead_forms')
              .select('workspace_id')
              .eq('form_id', resolvedFormId)
              .maybeSingle();

            let workspaceId = formRecord?.workspace_id;

            // Fallback: find first workspace (for single-tenant setups)
            if (!workspaceId) {
              const { data: ws } = await supabase
                .from('workspaces')
                .select('id')
                .limit(1)
                .single();
              workspaceId = ws?.id;
            }

            if (!workspaceId) {
              console.error('[WEBHOOK] Could not resolve workspace for lead', leadgenId);
              continue;
            }

            const extractField = (name: string) => {
              const f = fieldData.find((fd: any) =>
                fd.name?.toLowerCase() === name.toLowerCase() ||
                fd.name?.toLowerCase().includes(name.toLowerCase())
              );
              return f?.values?.[0] || null;
            };

            const metaLeadRow = {
                workspace_id: workspaceId,
                lead_id: lead.id,
                form_id: resolvedFormId,
                campaign_id: lead.campaign_id || null,
                adset_id: lead.adset_id || adgroupId || null,
                ad_id: lead.ad_id || adId || null,
                created_time: lead.created_time || new Date(createdTime * 1000).toISOString(),
                field_data: fieldMap,
                lead_name: extractField('full_name') || extractField('nome') || extractField('name'),
                lead_email: extractField('email'),
                lead_phone: extractField('phone_number') || extractField('telefone') || extractField('phone'),
                is_organic: lead.is_organic || false,
                platform: lead.platform || 'facebook',
                raw_json: lead,
                synced_at: new Date().toISOString(),
              };

            const { error } = await supabase
              .from('meta_leads')
              .upsert(metaLeadRow, { onConflict: 'workspace_id,lead_id' });

            if (error) {
              console.error(`[WEBHOOK] Upsert error for lead ${leadgenId}:`, JSON.stringify(error));
            } else {
              leadsProcessed++;
              console.log(`[WEBHOOK] ✅ Lead ${leadgenId} saved (form: ${resolvedFormId})`);

              // ─── Auto-create funnel_leads entry ───
              const funnelLead = {
                workspace_id: workspaceId,
                lead_id: `meta_${lead.id}`,
                name: metaLeadRow.lead_name || null,
                email: metaLeadRow.lead_email || null,
                phone: metaLeadRow.lead_phone || null,
                campaign_id: metaLeadRow.campaign_id || null,
                adset_id: metaLeadRow.adset_id || null,
                ad_id: metaLeadRow.ad_id || null,
                source: 'meta_lead_ads',
                stage: 'lead',
                utm_source: fieldMap['utm_source'] || 'facebook',
                utm_medium: fieldMap['utm_medium'] || 'paid',
                utm_campaign: fieldMap['utm_campaign'] || metaLeadRow.campaign_id || null,
                utm_content: fieldMap['utm_content'] || metaLeadRow.ad_id || null,
                utm_term: fieldMap['utm_term'] || null,
                created_at: metaLeadRow.created_time,
              };

              const { error: funnelErr } = await supabase
                .from('funnel_leads')
                .upsert(funnelLead, { onConflict: 'workspace_id,lead_id' });

              if (funnelErr) {
                console.error(`[WEBHOOK] funnel_leads upsert error for ${leadgenId}:`, JSON.stringify(funnelErr));
              } else {
                console.log(`[WEBHOOK] ✅ funnel_lead created for ${leadgenId}`);
              }
            }
          } catch (e: any) {
            console.error(`[WEBHOOK] Error processing lead ${leadgenId}:`, e.message);
          }
        }
      }

      console.log(`[WEBHOOK] Processed ${leadsProcessed} leads`);
      return new Response(
        JSON.stringify({ success: true, leads_processed: leadsProcessed }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      console.error('[WEBHOOK] Error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
