import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
      console.log(`[LEADS] Retryable error (${res.status}), attempt ${i + 1}/${retries}, retrying in ${wait}ms...`);
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

function extractField(fieldData: any[], fieldName: string): string | null {
  if (!Array.isArray(fieldData)) return null;
  const field = fieldData.find((f: any) =>
    f.name?.toLowerCase() === fieldName.toLowerCase() ||
    f.name?.toLowerCase().includes(fieldName.toLowerCase())
  );
  return field?.values?.[0] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    const defaultAdAccountId = Deno.env.get('META_AD_ACCOUNT_ID');
    if (!accessToken) throw new Error('Missing META_ACCESS_TOKEN');

    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    const workspaceId = body.workspace_id;
    if (!workspaceId) throw new Error('Missing workspace_id');

    const externalAccountId = body.ad_account_id || defaultAdAccountId;
    if (!externalAccountId) throw new Error('Missing ad_account_id');

    const accountId = externalAccountId.startsWith('act_') ? externalAccountId : `act_${externalAccountId}`;

    // Get ad_account DB id
    const cleanId = externalAccountId.replace(/^act_/, '');
    const { data: acc } = await supabase
      .from('ad_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('external_account_id', cleanId)
      .maybeSingle();
    const adAccountDbId = acc?.id || null;

    // ─── STEP 1: Discover Lead Forms from pages linked to the ad account ───
    // First, get the page IDs from the ad account
    const pagesUrl = `https://graph.facebook.com/v21.0/${accountId}?fields=instagram_accounts,owned_pages&access_token=${accessToken}`;
    let pageIds: string[] = [];

    try {
      const pagesRes = await fetchWithRetry(pagesUrl);
      const pagesJson = await pagesRes.json();
      if (pagesJson.owned_pages?.data) {
        pageIds = pagesJson.owned_pages.data.map((p: any) => p.id);
      }
    } catch (e) {
      console.log('[LEADS] Could not fetch pages from ad account, trying form_ids from body');
    }

    // Allow explicit form_ids
    const formIds: string[] = body.form_ids || [];

    // Fetch forms from pages
    for (const pageId of pageIds) {
      try {
        const formsUrl = `https://graph.facebook.com/v21.0/${pageId}/leadgen_forms?fields=id,name,status,page_id,created_time&limit=500&access_token=${accessToken}`;
        const forms = await fetchAllPages(formsUrl);
        console.log(`[LEADS] Page ${pageId}: ${forms.length} forms found`);

        for (const form of forms) {
          formIds.push(form.id);

          // Upsert form metadata
          await supabase.from('meta_lead_forms').upsert({
            workspace_id: workspaceId,
            ad_account_id: adAccountDbId,
            form_id: form.id,
            name: form.name || null,
            status: form.status || null,
            page_id: form.page_id || pageId,
            created_time: form.created_time || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'workspace_id,form_id' });
        }
      } catch (e: any) {
        console.error(`[LEADS] Error fetching forms for page ${pageId}:`, e.message);
      }
    }

    if (formIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, leads_synced: 0, forms: 0, message: 'Nenhum formulário de lead encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate form IDs
    const uniqueFormIds = [...new Set(formIds)];
    console.log(`[LEADS] Processing ${uniqueFormIds.length} forms`);

    // ─── STEP 2: Fetch leads from each form ───
    let totalLeads = 0;
    let totalUpserted = 0;

    // Optional date filter
    const since = body.since; // Unix timestamp or ISO date
    const sinceTs = since ? (typeof since === 'string' ? Math.floor(new Date(since).getTime() / 1000) : since) : null;

    for (const formId of uniqueFormIds) {
      try {
        let leadsUrl = `https://graph.facebook.com/v21.0/${formId}/leads?fields=id,created_time,field_data,campaign_id,adset_id,ad_id,is_organic,platform&limit=500&access_token=${accessToken}`;
        if (sinceTs) {
          leadsUrl += `&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${sinceTs}}]`;
        }

        const leads = await fetchAllPages(leadsUrl);
        totalLeads += leads.length;
        console.log(`[LEADS] Form ${formId}: ${leads.length} leads fetched`);

        if (leads.length === 0) continue;

        // Transform leads
        const rows = leads.map((lead: any) => {
          const fieldData = lead.field_data || [];
          const fieldMap: Record<string, string> = {};
          for (const f of fieldData) {
            fieldMap[f.name] = f.values?.[0] || '';
          }

          return {
            workspace_id: workspaceId,
            lead_id: lead.id,
            form_id: formId,
            campaign_id: lead.campaign_id || null,
            adset_id: lead.adset_id || null,
            ad_id: lead.ad_id || null,
            created_time: lead.created_time,
            field_data: fieldMap,
            lead_name: extractField(fieldData, 'full_name') || extractField(fieldData, 'nome') || extractField(fieldData, 'name') || null,
            lead_email: extractField(fieldData, 'email') || null,
            lead_phone: extractField(fieldData, 'phone_number') || extractField(fieldData, 'telefone') || extractField(fieldData, 'phone') || null,
            is_organic: lead.is_organic || false,
            platform: lead.platform || 'facebook',
            raw_json: lead,
            synced_at: new Date().toISOString(),
          };
        });

        // Batch upsert
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error, data } = await supabase
            .from('meta_leads')
            .upsert(batch, { onConflict: 'workspace_id,lead_id' })
            .select('id');
          if (error) {
            console.error(`[LEADS] Upsert error for form ${formId}:`, JSON.stringify(error));
          } else {
            totalUpserted += data?.length || batch.length;
          }
        }
      } catch (e: any) {
        console.error(`[LEADS] Error fetching leads for form ${formId}:`, e.message);
      }
    }

    console.log(`[LEADS] ✅ COMPLETE: ${totalUpserted}/${totalLeads} leads upserted from ${uniqueFormIds.length} forms`);

    return new Response(
      JSON.stringify({
        success: true,
        forms: uniqueFormIds.length,
        leads_fetched: totalLeads,
        leads_synced: totalUpserted,
        message: `${totalUpserted} leads sincronizados de ${uniqueFormIds.length} formulários`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[LEADS] Sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
