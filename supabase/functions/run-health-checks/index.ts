import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { workspace_id } = await req.json();
    if (!workspace_id) throw new Error('workspace_id required');

    const issues: Array<{
      check_type: string; status: string; entity: string;
      issue_description: string; recommendation: string;
    }> = [];
    const gaps: Array<{
      gap_type: string; campaign_id?: string; campaign_name?: string;
      date_from?: string; date_to?: string; affected_records: number;
      severity: string; notes?: string;
    }> = [];

    const now = new Date();
    const yesterday = new Date(now.getTime() - 25 * 3600 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400 * 1000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000).toISOString().slice(0, 10);

    // ═══ 1. SYNC INTEGRITY ═══
    const { data: connectors } = await sb
      .from('connectors')
      .select('last_successful_sync, status')
      .eq('workspace_id', workspace_id)
      .eq('provider', 'meta')
      .limit(1);

    const connector = connectors?.[0];
    if (!connector || !connector.last_successful_sync) {
      issues.push({
        check_type: 'sync', status: 'critical', entity: 'Meta Ads Connector',
        issue_description: 'Nenhuma sincronização encontrada. Os dados podem estar desatualizados.',
        recommendation: 'Vá em Configurações → Meta Ads e execute uma sincronização manual.',
      });
    } else {
      const lastSync = new Date(connector.last_successful_sync);
      const hoursSince = (now.getTime() - lastSync.getTime()) / 3600000;
      if (hoursSince > 25) {
        issues.push({
          check_type: 'sync', status: hoursSince > 48 ? 'critical' : 'warning',
          entity: 'Meta Ads Sync',
          issue_description: `Última sincronização há ${Math.round(hoursSince)}h. O máximo recomendado é 24h.`,
          recommendation: 'Verifique se o token do Meta ainda é válido e execute uma sincronização manual.',
        });
      }
    }

    // Check active campaigns without recent data
    const { data: activeCampaigns } = await sb
      .from('meta_campaigns')
      .select('campaign_id, name')
      .eq('workspace_id', workspace_id)
      .eq('effective_status', 'ACTIVE');

    if (activeCampaigns && activeCampaigns.length > 0) {
      const todayStr = now.toISOString().slice(0, 10);
      const { data: recentFacts } = await sb
        .from('facts_meta_insights_daily')
        .select('campaign_id')
        .eq('workspace_id', workspace_id)
        .gte('date', twoDaysAgo)
        .gt('spend', 0);

      const recentCampaignIds = new Set((recentFacts || []).map(f => f.campaign_id));
      for (const c of activeCampaigns) {
        if (!recentCampaignIds.has(c.campaign_id)) {
          gaps.push({
            gap_type: 'missing_data', campaign_id: c.campaign_id, campaign_name: c.name,
            date_from: twoDaysAgo, date_to: todayStr, affected_records: 0,
            severity: 'high', notes: `Campanha ativa \\"${c.name}\\" sem dados nas últimas 48h.`,
          });
        }
      }
    }

    // ═══ 2. UTM COMPLETENESS ═══
    const { data: recentLeads } = await sb
      .from('funnel_leads')
      .select('utm_source, utm_campaign, campaign_id, name')
      .eq('workspace_id', workspace_id)
      .gte('created_at', sevenDaysAgo);

    if (recentLeads && recentLeads.length > 0) {
      const noUtm = recentLeads.filter(l => !l.utm_source || !l.utm_campaign);
      const pct = (noUtm.length / recentLeads.length) * 100;
      if (pct > 10) {
        issues.push({
          check_type: 'utm',
          status: pct > 30 ? 'critical' : 'warning',
          entity: `${noUtm.length} de ${recentLeads.length} leads`,
          issue_description: `${pct.toFixed(0)}% dos leads dos últimos 7 dias estão sem UTM preenchido. Impossível rastrear a origem.`,
          recommendation: 'Verifique se todas as campanhas têm UTMs configurados nos links. Use o padrão: utm_source=meta&utm_campaign={campaign_name}.',
        });

        // Identify which campaigns generate leads without UTM
        const campaignsMissing: Record<string, number> = {};
        noUtm.forEach(l => {
          const key = l.campaign_id || 'unknown';
          campaignsMissing[key] = (campaignsMissing[key] || 0) + 1;
        });
        Object.entries(campaignsMissing).forEach(([cid, count]) => {
          gaps.push({
            gap_type: 'missing_utm', campaign_id: cid === 'unknown' ? undefined : cid,
            affected_records: count, severity: count > 5 ? 'high' : 'medium',
            notes: `${count} leads sem UTM vinculados a esta campanha.`,
          });
        });
      }
    }

    // ═══ 3. PIXEL / CAPI (simulated check via lead quality) ═══
    const { data: metaLeads } = await sb
      .from('meta_leads')
      .select('lead_id, created_time, lead_email, lead_phone')
      .eq('workspace_id', workspace_id)
      .gte('created_time', sevenDaysAgo)
      .order('created_time', { ascending: true })
      .limit(500);

    if (metaLeads && metaLeads.length > 0) {
      // Check for duplicate events (same lead within 5 minutes)
      const dupes: string[] = [];
      for (let i = 1; i < metaLeads.length; i++) {
        const prev = metaLeads[i - 1];
        const curr = metaLeads[i];
        if (prev.lead_email && curr.lead_email && prev.lead_email === curr.lead_email) {
          const diff = new Date(curr.created_time).getTime() - new Date(prev.created_time).getTime();
          if (diff < 5 * 60 * 1000) dupes.push(curr.lead_email);
        }
      }
      if (dupes.length > 0) {
        issues.push({
          check_type: 'pixel', status: 'warning', entity: 'Eventos Lead duplicados',
          issue_description: `${dupes.length} eventos Lead duplicados detectados (mesmo email em < 5 min). Possível disparo duplo do pixel.`,
          recommendation: 'Verifique se o pixel e o CAPI não estão ambos disparando o mesmo evento sem deduplicação. Use event_id para deduplicar.',
        });
      }
    }

    // ═══ 4. ATTRIBUTION (Meta 2026) ═══
    // Check for deprecated attribution windows in facts
    const { data: attrCheck } = await sb
      .from('facts_meta_insights_daily')
      .select('attribution_setting')
      .eq('workspace_id', workspace_id)
      .gte('date', sevenDaysAgo)
      .limit(100);

    if (attrCheck) {
      const deprecated = attrCheck.filter(r =>
        r.attribution_setting?.includes('28d') || r.attribution_setting?.includes('7d_view')
      );
      if (deprecated.length > 0) {
        issues.push({
          check_type: 'attribution', status: 'critical',
          entity: `${deprecated.length} registros`,
          issue_description: 'Detectadas janelas de atribuição descontinuadas (28-day view-through ou 7-day view). Removidas pela Meta em jan/2026.',
          recommendation: 'Atualize todas as campanhas para usar 7-day click / 1-day view como janela de atribuição padrão.',
        });
      }
    }

    // ═══ 5. DATA GAPS ═══
    // Campaigns with spend > 0 but 0 leads for > 48h
    const { data: spendNoLeads } = await sb
      .from('facts_meta_insights_daily')
      .select('campaign_id, date, spend, results_leads')
      .eq('workspace_id', workspace_id)
      .gte('date', twoDaysAgo)
      .gt('spend', 0)
      .eq('results_leads', 0);

    if (spendNoLeads && spendNoLeads.length > 0) {
      const byCampaign: Record<string, number> = {};
      spendNoLeads.forEach(r => {
        byCampaign[r.campaign_id] = (byCampaign[r.campaign_id] || 0) + 1;
      });
      Object.entries(byCampaign).filter(([, days]) => days >= 2).forEach(([cid, days]) => {
        issues.push({
          check_type: 'sync', status: 'critical', entity: `Campanha ${cid}`,
          issue_description: `Campanha com spend > R$0 e 0 leads há ${days}+ dias. Possível problema no pixel ou formulário.`,
          recommendation: 'Verifique se o pixel está disparando corretamente e se o formulário de lead está funcional.',
        });
        gaps.push({
          gap_type: 'zero_leads', campaign_id: cid, date_from: twoDaysAgo,
          date_to: now.toISOString().slice(0, 10), affected_records: days,
          severity: 'critical', notes: 'Spend sem conversões por mais de 48h.',
        });
      });
    }

    // Leads without campaign
    if (recentLeads) {
      const orphanLeads = recentLeads.filter(l => !l.campaign_id);
      if (orphanLeads.length > 0) {
        gaps.push({
          gap_type: 'missing_data', affected_records: orphanLeads.length,
          severity: 'medium', notes: `${orphanLeads.length} leads sem campanha de origem nos últimos 7 dias.`,
        });
      }
    }

    // ═══ 6. LEAD QUALITY ═══
    if (metaLeads && metaLeads.length > 0) {
      const invalidEmail = metaLeads.filter(l => {
        if (!l.lead_email) return false;
        const e = l.lead_email.toLowerCase();
        return !e.includes('@') || /(@(mailinator|tempmail|guerrilla|throwaway|yopmail))/.test(e);
      });
      if (invalidEmail.length > 0) {
        const pct = ((invalidEmail.length / metaLeads.length) * 100).toFixed(1);
        issues.push({
          check_type: 'utm', status: invalidEmail.length > metaLeads.length * 0.1 ? 'critical' : 'warning',
          entity: `${invalidEmail.length} leads`,
          issue_description: `${pct}% dos leads recentes têm email inválido ou de domínio temporário.`,
          recommendation: 'Adicione validação de email no formulário de lead. Considere usar campos de verificação no Meta Lead Form.',
        });
      }

      const invalidPhone = metaLeads.filter(l => {
        if (!l.lead_phone) return false;
        const digits = l.lead_phone.replace(/\D/g, '');
        return digits.length < 10;
      });
      if (invalidPhone.length > 0) {
        issues.push({
          check_type: 'utm', status: 'warning',
          entity: `${invalidPhone.length} leads`,
          issue_description: `${invalidPhone.length} leads com telefone inválido (< 10 dígitos).`,
          recommendation: 'Configure o formulário para exigir DDD + telefone. Use máscara de input.',
        });
      }

      // Duplicate leads (same email within 7 days)
      const emails = metaLeads.filter(l => l.lead_email).map(l => l.lead_email!.toLowerCase());
      const emailCount: Record<string, number> = {};
      emails.forEach(e => { emailCount[e] = (emailCount[e] || 0) + 1; });
      const dupeCount = Object.values(emailCount).filter(c => c > 1).length;
      if (dupeCount > 0) {
        issues.push({
          check_type: 'pixel', status: dupeCount > 10 ? 'critical' : 'warning',
          entity: `${dupeCount} emails duplicados`,
          issue_description: `${dupeCount} leads com mesmo email nos últimos 7 dias. Possível resubmissão ou falha de deduplicação.`,
          recommendation: 'Implemente deduplicação por email no webhook ou CRM. Verifique se o formulário não permite reenvio.',
        });
      }
    }

    // ═══ SAVE RESULTS ═══
    // Clear old checks for this workspace (keep last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    await sb.from('data_health_checks').delete()
      .eq('workspace_id', workspace_id)
      .lt('checked_at', thirtyDaysAgo);

    // Insert new checks
    if (issues.length > 0) {
      await sb.from('data_health_checks').insert(
        issues.map(i => ({ ...i, workspace_id }))
      );
    }

    // Insert gaps (only if not already open for same type+campaign)
    for (const gap of gaps) {
      const { data: existing } = await sb.from('data_gaps')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('gap_type', gap.gap_type)
        .eq('status', 'open')
        .eq('campaign_id', gap.campaign_id || '')
        .limit(1);

      if (!existing || existing.length === 0) {
        await sb.from('data_gaps').insert({ ...gap, workspace_id });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      issues_found: issues.length,
      gaps_found: gaps.length,
      checks: issues,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
