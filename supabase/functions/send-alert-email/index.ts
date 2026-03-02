import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_RECIPIENTS = ['pedro@bwild.com.br', 'matheus@bwild.com.br'];

const OPERATOR_LABELS: Record<string, string> = {
  gt: 'maior que',
  lt: 'menor que',
  gte: 'maior ou igual a',
  lte: 'menor ou igual a',
  change_gt: 'variação acima de',
  change_lt: 'variação abaixo de',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('Missing RESEND_API_KEY secret');

    const body = await req.json();
    const {
      rule_name,
      metric_label,
      current_value,
      threshold,
      operator,
      severity,
      entity_name,
      app_url,
      recipients,
    } = body;

    if (!rule_name || !metric_label) throw new Error('Missing rule_name or metric_label');

    const to = recipients?.length ? recipients : DEFAULT_RECIPIENTS;
    const operatorLabel = OPERATOR_LABELS[operator] || operator;
    const severityEmoji = severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🔵';
    const alertsUrl = app_url || 'https://meta-mo-compare.lovable.app';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:'Segoe UI',Arial,sans-serif;color:#e0e0e6">
  <div style="max-width:560px;margin:40px auto;background:#12121a;border-radius:12px;border:1px solid #1e1e2e;overflow:hidden">
    <div style="background:linear-gradient(135deg,#1a1a2e,#16162a);padding:24px 28px;border-bottom:1px solid #1e1e2e">
      <h1 style="margin:0;font-size:18px;color:#e0e0e6">${severityEmoji} Alerta: ${rule_name}</h1>
    </div>
    <div style="padding:28px">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:8px 0;color:#8b8b9e;font-size:13px;width:140px">Métrica</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600">${metric_label}</td>
        </tr>
        ${entity_name ? `
        <tr>
          <td style="padding:8px 0;color:#8b8b9e;font-size:13px">Campanha</td>
          <td style="padding:8px 0;font-size:14px">${entity_name}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;color:#8b8b9e;font-size:13px">Valor atual</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;color:#ef4444">${Number(current_value).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#8b8b9e;font-size:13px">Limite</td>
          <td style="padding:8px 0;font-size:14px">${operatorLabel} ${Number(threshold).toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#8b8b9e;font-size:13px">Severidade</td>
          <td style="padding:8px 0;font-size:14px">${severityEmoji} ${severity?.toUpperCase()}</td>
        </tr>
      </table>
      <a href="${alertsUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600">
        Ver no Dashboard →
      </a>
    </div>
    <div style="padding:16px 28px;border-top:1px solid #1e1e2e;text-align:center">
      <span style="font-size:11px;color:#55575d">Meta Ads Command Center · Alerta automático</span>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Meta Ads Alerts <onboarding@resend.dev>',
        to,
        subject: `${severityEmoji} Alerta ${severity?.toUpperCase()}: ${metric_label} — ${rule_name}`,
        html: htmlBody,
      }),
    });

    const resData = await res.json();

    if (!res.ok) {
      console.error('[ALERT-EMAIL] Resend error:', JSON.stringify(resData));
      throw new Error(`Resend API error: ${res.status} - ${JSON.stringify(resData)}`);
    }

    console.log(`[ALERT-EMAIL] ✅ Email sent to ${to.join(', ')} for rule "${rule_name}"`);

    return new Response(
      JSON.stringify({ success: true, email_id: resData.id, recipients: to }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[ALERT-EMAIL] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
