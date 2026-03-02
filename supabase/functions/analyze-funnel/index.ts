import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, funnelData, leadData } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    let userPrompt = "";

    if (mode === "funnel" && funnelData) {
      const f = funnelData;
      userPrompt = `Analise o funil de leads da bwild e identifique os principais gargalos e oportunidades.

PERÍODO: ${f.period || "Últimos 30 dias"}
INVESTIMENTO TOTAL: R$ ${f.total_spend?.toFixed(2) || "N/A"}
ATRIBUIÇÃO: 7-day click / 1-day view (padrão Meta 2026)

FUNIL GERAL:
- Leads gerados: ${f.total_leads}
- Contatados: ${f.contacted} (${f.contact_rate?.toFixed(1)}%)
- MQL: ${f.mql_count} (${f.mql_rate?.toFixed(1)}%)
- SQL: ${f.sql_count} (${f.sql_rate?.toFixed(1)}% dos MQL)
- Agendados: ${f.scheduled} (${f.schedule_rate?.toFixed(1)}% dos SQL)
- Fechados: ${f.closed_won} (${f.close_rate?.toFixed(1)}% dos agendados)
- Receita: R$ ${f.total_revenue?.toFixed(2) || "0"}
- ROAS Real: ${f.roas_real?.toFixed(2) || "N/A"}x

TEMPO MÉDIO ATÉ 1º CONTATO: ${f.avg_contact_time?.toFixed(0) || "N/A"} minutos
SLA < 5 minutos: ${f.sla_pct?.toFixed(1) || "N/A"}%

TOP MOTIVOS DE PERDA:
${JSON.stringify(f.lost_reasons || {}, null, 2)}

FUNIL POR ORIGEM (top 3):
${JSON.stringify(f.by_source || [], null, 2)}

FUNIL POR CAMPANHA (top 3):
${JSON.stringify(f.by_campaign || [], null, 2)}

REFERÊNCIAS INTERNAS (Guia de Bordo bwild):
- Taxa de contato saudável: ≥ 60%
- SLA ideal: 1ª tentativa < 5 min; 6–8 tentativas em 3 dias
- Sinal de baixa qualidade: %MQL caindo, muitos leads inválidos, taxa de contato < 60%
- Ação: negativar públicos ruins, qualificar copy ("para empresas com faturamento > R$X"), adicionar 1–2 perguntas filtro no formulário
- Considerar migração para Advantage+ Audience se qualidade de lead estiver caindo com interesses manuais

Analise e responda:
1. Qual o maior gargalo do funil agora? (onde mais leads estão sendo perdidos)
2. O problema é de qualidade de lead (tráfego/copy) ou de processo de vendas (SLA/abordagem)?
3. Qual campanha/origem gera leads de melhor qualidade (não só volume)?
4. 3 ações concretas para melhorar o funil agora
5. O ROAS Real está saudável para o negócio?`;
    } else if (mode === "lead" && leadData) {
      const l = leadData;
      userPrompt = `Analise este lead e dê uma recomendação de abordagem.

LEAD:
Nome: ${l.name || "N/A"}
Origem: ${l.utm_source || "N/A"} / ${l.utm_campaign || "N/A"}
Anúncio: ${l.utm_content || "N/A"}
Etapa atual: ${l.stage}
Dias na etapa: ${l.days_in_stage}
Tentativas de contato: ${l.contact_attempts}
Tempo até 1º contato: ${l.time_to_first_contact_minutes || "Sem contato"} minutos
Notas: ${l.qualification_notes || "Nenhuma"}

HISTÓRICO DE ETAPAS:
${JSON.stringify(l.stage_history || [], null, 2)}

Com base no perfil e histórico, responda:
1. Qual o perfil provável deste lead?
2. Qual a abordagem de contato recomendada?
3. Qual objeção é mais provável e como contornar?
4. Vale continuar tentando ou marcar como perdido?`;
    } else {
      throw new Error("Invalid mode or missing data");
    }

    const systemPrompt = `Você é um analista sênior de tráfego pago da agência bwild. Analise os dados de funil fornecidos com base no Guia de Bordo interno. Seja objetivo, direto e orientado a resultados. Responda em português brasileiro. Máximo 400 palavras.

MUDANÇAS META 2026: Atribuição padrão é 7d click / 1d view. Advantage+ Audience é a segmentação recomendada. ThruPlay é a métrica de vídeo principal.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("API error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI API error" }), {
        status: response.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-funnel error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
