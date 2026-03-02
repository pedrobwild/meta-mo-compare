import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em mídia paga e planejamento de budget para Meta Ads. Analise os cenários de simulação e dê uma recomendação clara e objetiva. Responda em português brasileiro.

## BENCHMARKS
- ROAS saudável: acima de 3x (e-commerce), acima de 5x (performance)
- CPA: compare com histórico da conta
- CTR saudável: acima de 1,5% (feed), acima de 0,8% (stories)
- Frequência: acima de 3,5 = fadiga criativa
- CPM elevado: acima de R$25 merece atenção

## REGRAS
- Seja direto e objetivo
- Cite números reais dos cenários
- Nunca invente dados
- Sempre justifique com base nos dados históricos fornecidos`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { objetivo, valorObjetivo, periodoDias, historico, cenarios } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const userPrompt = `Analise os 3 cenários de budget simulados abaixo e recomende o melhor para o objetivo do anunciante.

Objetivo declarado: ${objetivo} de ${valorObjetivo}
Período: ${periodoDias} dias

Histórico dos últimos 30 dias:
- ROAS médio: ${historico.roas}x
- CPA médio: R$ ${historico.cpa}
- Conversões médias/mês: ${historico.conversoes}
- Investimento médio/mês: R$ ${historico.investimento}
- CTR médio: ${historico.ctr}%
- CPM médio: R$ ${historico.cpm}

Cenários simulados:
${JSON.stringify(cenarios, null, 2)}

Use a tool "budget_analysis" para retornar sua análise estruturada.`;

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
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{
          name: "budget_analysis",
          description: "Retorna análise estruturada dos cenários de budget",
          input_schema: {
            type: "object",
            properties: {
              cenario_recomendado: {
                type: "string",
                enum: ["conservador", "realista", "agressivo"],
                description: "Cenário recomendado"
              },
              justificativa: {
                type: "string",
                description: "Justificativa da recomendação (máx 80 palavras)"
              },
              riscos: {
                type: "string",
                description: "Riscos do cenário agressivo (máx 60 palavras)"
              },
              o_que_monitorar: {
                type: "array",
                items: { type: "string" },
                description: "Lista de métricas a monitorar com thresholds"
              },
              alerta: {
                type: "string",
                description: "Alerta crítico opcional, só se houver risco alto"
              },
            },
            required: ["cenario_recomendado", "justificativa", "riscos", "o_que_monitorar"],
          }
        }],
        tool_choice: { type: "tool", name: "budget_analysis" },
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

    if (toolUse?.input) {
      return new Response(JSON.stringify(toolUse.input), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "IA não retornou análise estruturada" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("budget analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
