import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, options?: RequestInit, retries = 4, backoff = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && i < retries - 1) {
      const wait = backoff * Math.pow(2, i);
      console.log(`[IG] Retry ${i + 1}/${retries} (${res.status}), waiting ${wait}ms`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Graph API error ${res.status}: ${text}`);
  }
  throw new Error('Max retries');
}

async function fetchAllPages(url: string): Promise<any[]> {
  const all: any[] = [];
  let next: string | null = url;
  while (next) {
    const res = await fetchWithRetry(next);
    const json = await res.json();
    if (json.data) all.push(...json.data);
    next = json.paging?.next || null;
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) throw new Error('Missing META_ACCESS_TOKEN');

    let body: any = {};
    try { body = await req.json(); } catch {}

    const workspaceId = body.workspace_id;
    if (!workspaceId) throw new Error('Missing workspace_id');

    const action = body.action || 'sync'; // sync | send_message

    // ─── SEND MESSAGE ───
    if (action === 'send_message') {
      const recipientId = body.recipient_id;
      const messageText = body.message;
      if (!recipientId || !messageText) throw new Error('Missing recipient_id or message');

      // Get page ID and page access token
      const igUserId = body.ig_user_id;
      if (!igUserId) throw new Error('Missing ig_user_id for sending messages');

      // Send via IG Messaging API
      const sendUrl = `https://graph.facebook.com/v21.0/${igUserId}/messages`;
      const sendRes = await fetchWithRetry(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: messageText },
          access_token: accessToken,
        }),
      });
      const sendJson = await sendRes.json();
      console.log('[IG] Message sent:', JSON.stringify(sendJson));

      return new Response(
        JSON.stringify({ success: true, result: sendJson }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── SYNC ───
    // Step 1: Find IG Business Account from ad account pages
    let igUserId = body.ig_user_id;

    if (!igUserId) {
      const adAccountId = body.ad_account_id || Deno.env.get('META_AD_ACCOUNT_ID');
      if (adAccountId) {
        const accId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        try {
          const pagesUrl = `https://graph.facebook.com/v21.0/${accId}?fields=owned_pages{instagram_business_account}&access_token=${accessToken}`;
          const pagesRes = await fetchWithRetry(pagesUrl);
          const pagesJson = await pagesRes.json();
          const pages = pagesJson.owned_pages?.data || [];
          for (const p of pages) {
            if (p.instagram_business_account?.id) {
              igUserId = p.instagram_business_account.id;
              break;
            }
          }
        } catch (e: any) {
          console.log('[IG] Could not discover IG account from ad account:', e.message);
        }
      }

      // Fallback: try /me/accounts
      if (!igUserId) {
        try {
          const meUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`;
          const meRes = await fetchWithRetry(meUrl);
          const meJson = await meRes.json();
          for (const page of meJson.data || []) {
            if (page.instagram_business_account?.id) {
              igUserId = page.instagram_business_account.id;
              break;
            }
          }
        } catch (e: any) {
          console.log('[IG] Could not discover IG account from /me/accounts:', e.message);
        }
      }
    }

    if (!igUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhuma conta Instagram Business encontrada. Passe ig_user_id no body ou verifique as permissões do token.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[IG] Using IG User ID: ${igUserId}`);

    const results = {
      media: { fetched: 0, upserted: 0 },
      insights: { fetched: 0, upserted: 0 },
      conversations: { fetched: 0, upserted: 0 },
      messages: { fetched: 0, upserted: 0 },
    };

    // ─── STEP 2: Fetch media (posts) ───
    const mediaUrl = `https://graph.facebook.com/v21.0/${igUserId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count&limit=50&access_token=${accessToken}`;
    const mediaItems = await fetchAllPages(mediaUrl);
    results.media.fetched = mediaItems.length;
    console.log(`[IG] ${mediaItems.length} media posts fetched`);

    if (mediaItems.length > 0) {
      const mediaRows = mediaItems.map((m: any) => ({
        workspace_id: workspaceId,
        ig_user_id: igUserId,
        media_id: m.id,
        media_type: m.media_type || null,
        media_url: m.media_url || null,
        thumbnail_url: m.thumbnail_url || null,
        permalink: m.permalink || null,
        caption: m.caption || null,
        timestamp: m.timestamp || null,
        like_count: m.like_count || 0,
        comments_count: m.comments_count || 0,
        updated_at: new Date().toISOString(),
      }));

      for (let i = 0; i < mediaRows.length; i += 200) {
        const batch = mediaRows.slice(i, i + 200);
        const { error, data } = await supabase
          .from('ig_media')
          .upsert(batch, { onConflict: 'workspace_id,media_id' })
          .select('id');
        if (error) console.error('[IG] Media upsert error:', JSON.stringify(error));
        else results.media.upserted += data?.length || batch.length;
      }
    }

    // ─── STEP 3: Fetch insights for each media ───
    for (const m of mediaItems) {
      try {
        const isVideo = m.media_type === 'VIDEO' || m.media_type === 'REELS';
        const metricsParam = isVideo
          ? 'impressions,reach,saved,shares,video_views'
          : 'impressions,reach,saved,shares';

        const insightsUrl = `https://graph.facebook.com/v21.0/${m.id}/insights?metric=${metricsParam}&access_token=${accessToken}`;
        const insightsRes = await fetchWithRetry(insightsUrl);
        const insightsJson = await insightsRes.json();

        const metrics: Record<string, number> = {};
        for (const d of insightsJson.data || []) {
          metrics[d.name] = d.values?.[0]?.value || 0;
        }

        // Engagement = likes + comments + saved + shares
        const engagement = (m.like_count || 0) + (m.comments_count || 0) + (metrics.saved || 0) + (metrics.shares || 0);

        const { error } = await supabase
          .from('ig_media_insights')
          .upsert({
            workspace_id: workspaceId,
            media_id: m.id,
            impressions: metrics.impressions || 0,
            reach: metrics.reach || 0,
            engagement,
            saved: metrics.saved || 0,
            shares: metrics.shares || 0,
            video_views: metrics.video_views || 0,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'workspace_id,media_id' });

        if (!error) results.insights.upserted++;
        results.insights.fetched++;
      } catch (e: any) {
        // Insights may fail for stories or carousel children
        console.log(`[IG] Insight skip for ${m.id}: ${e.message?.slice(0, 80)}`);
      }
    }

    console.log(`[IG] ${results.insights.upserted}/${results.insights.fetched} insights upserted`);

    // ─── STEP 4: Fetch conversations (DMs) ───
    try {
      const convoUrl = `https://graph.facebook.com/v21.0/${igUserId}/conversations?fields=id,participants,updated_time&platform=instagram&limit=50&access_token=${accessToken}`;
      const convos = await fetchAllPages(convoUrl);
      results.conversations.fetched = convos.length;
      console.log(`[IG] ${convos.length} conversations fetched`);

      for (const convo of convos) {
        // Find the other participant (not the page)
        const participants = convo.participants?.data || [];
        const other = participants.find((p: any) => p.id !== igUserId) || participants[0];

        await supabase
          .from('ig_conversations')
          .upsert({
            workspace_id: workspaceId,
            conversation_id: convo.id,
            participant_id: other?.id || null,
            participant_name: other?.name || null,
            participant_username: other?.username || null,
            updated_time: convo.updated_time || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'workspace_id,conversation_id' });
        results.conversations.upserted++;

        // Fetch messages for this conversation
        try {
          const msgsUrl = `https://graph.facebook.com/v21.0/${convo.id}?fields=messages{id,message,from,created_time}&access_token=${accessToken}`;
          const msgsRes = await fetchWithRetry(msgsUrl);
          const msgsJson = await msgsRes.json();
          const messages = msgsJson.messages?.data || [];
          results.messages.fetched += messages.length;

          if (messages.length > 0) {
            const msgRows = messages.map((msg: any) => ({
              workspace_id: workspaceId,
              conversation_id: convo.id,
              message_id: msg.id,
              sender_id: msg.from?.id || null,
              message_text: msg.message || null,
              created_time: msg.created_time || null,
              is_from_page: msg.from?.id === igUserId,
              updated_at: new Date().toISOString(),
            }));

            const { error, data } = await supabase
              .from('ig_messages')
              .upsert(msgRows, { onConflict: 'workspace_id,message_id' })
              .select('id');
            if (!error) results.messages.upserted += data?.length || msgRows.length;
          }
        } catch (e: any) {
          console.log(`[IG] Messages skip for convo ${convo.id}: ${e.message?.slice(0, 80)}`);
        }
      }
    } catch (e: any) {
      console.log('[IG] Conversations error (may need instagram_manage_messages):', e.message?.slice(0, 120));
    }

    console.log(`[IG] ✅ SYNC COMPLETE:`, JSON.stringify(results));

    return new Response(
      JSON.stringify({
        success: true,
        ig_user_id: igUserId,
        ...results,
        message: `${results.media.upserted} posts, ${results.insights.upserted} insights, ${results.conversations.upserted} conversas, ${results.messages.upserted} msgs`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[IG] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
