import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um analista sênior de mídia paga da agência bwild. Sua função é escrever narrativas executivas claras, diretas e baseadas em dados reais para relatórios de Meta Ads.

Escreva em português brasileiro, tom profissional mas direto.
Nunca use linguagem vaga. Sempre cite números reais.
Retorne APENAS o conteúdo solicitado via tool calling.
Sem texto fora da tool.

## BENCHMARKS DE REFERÊNCIA (Meta Ads)
- ROAS saudável: acima de 3x (e-commerce), acima de 5x (performance)
- CTR saudável: acima de 1,5% (feed), acima de 0,8% (stories)
- Frequência: acima de 3,5 = sinal de fadiga criativa
- CPM elevado: acima de R$25 merece atenção`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { metricsContext } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    // Build structured user prompt with all data
    const ctx = metricsContext || {};
    const periodo = ctx.periodo || "N/A";
    const periodoAnterior = ctx.periodo_comparacao || "N/A";
    
    const ma = ctx.metricas_atuais || {};
    const mp = ctx.metricas_anteriores || {};
    
    const delta = (curr: number, prev: number) => {
      if (!prev || prev === 0) return "N/A";
      return ((curr - prev) / Math.abs(prev) * 100).toFixed(1) + "%";
    };

    const topCampanhasJson = ctx.top5_campanhas ? JSON.stringify(ctx.top5_campanhas, null, 2) : "[]";
    const alertasJson = ctx.alertas ? JSON.stringify(ctx.alertas, null, 2) : "[]";
    const decisoesJson = ctx.decisoes ? JSON.stringify(ctx.decisoes, null, 2) : "[]";

    const userPrompt = `Gere as 4 seções narrativas do relatório com base nos dados:

Período: ${periodo}
Período anterior: ${periodoAnterior}

KPIs do período atual:
- Investimento: R$ ${(ma.investimento || 0).toFixed(2)}
- ROAS: ${(ma.roas || 0).toFixed(2)}x (era ${(mp.roas || 0).toFixed(2)}x, variação: ${delta(ma.roas || 0, mp.roas || 0)})
- CPA: R$ ${(ma.cpa || 0).toFixed(2)} (era R$ ${(mp.cpa || 0).toFixed(2)}, variação: ${delta(ma.cpa || 0, mp.cpa || 0)})
- Conversões: ${ma.resultados || 0} (era ${mp.resultados || 0})
- CTR: ${(ma.ctr_link || 0).toFixed(2)}% (era ${(mp.ctr_link || 0).toFixed(2)}%)
- CPM: R$ ${(ma.cpm || 0).toFixed(2)}

Top 3 campanhas:
${topCampanhasJson}

Alertas disparados:
${alertasJson}

Decisões tomadas no período:
${decisoesJson}

Gere o JSON com as seções:
- resumo_executivo (máx 80 palavras)
- o_que_mudou (máx 120 palavras, cite variações com %)
- por_que (máx 120 palavras, explique os drivers)
- o_que_faremos (máx 120 palavras, 3 recomendações priorizadas)

Use a tool "generate_report_sections" para retornar as 4 seções.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        tools: [
          {
            name: "generate_report_sections",
            description: "Gera 4 seções narrativas para relatório executivo de Meta Ads.",
            input_schema: {
              type: "object",
              properties: {
                resumo_executivo: {
                  type: "string",
                  description: "Resumo executivo do período em até 80 palavras. Visão geral clara e direta."
                },
                o_que_mudou: {
                  type: "string",
                  description: "Seção 'O que mudou': variações relevantes do período com métricas e porcentagens. Máx 120 palavras."
                },
                por_que: {
                  type: "string",
                  description: "Seção 'Por quê': principais drivers das mudanças. Causa-efeito entre métricas. Máx 120 palavras."
                },
                o_que_faremos: {
                  type: "string",
                  description: "Seção 'O que faremos': 3 recomendações priorizadas com ações concretas, impacto esperado e urgência. Máx 120 palavras."
                },
              },
              required: ["resumo_executivo", "o_que_mudou", "por_que", "o_que_faremos"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "generate_report_sections" },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na API da Anthropic" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolUse = data.content?.find((b: any) => b.type === 'tool_use');
    if (!toolUse) {
      return new Response(JSON.stringify({ error: "IA não retornou seções estruturadas" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report narrative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
