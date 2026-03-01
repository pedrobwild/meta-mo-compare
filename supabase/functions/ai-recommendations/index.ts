import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um consultor sênior de performance em tráfego pago. 
Analise os dados de métricas fornecidos e gere recomendações acionáveis de melhoria.

Para cada recomendação, retorne usando a tool "generate_recommendations".

Critérios de análise:
- CPA acima de benchmark → sugerir otimização de público ou criativo
- CTR baixo (<1%) → sugerir revisão de copy/criativo
- Frequência alta (>3) → sugerir expansão de público ou renovação de criativos
- CPM subindo → sugerir diversificação de posicionamento
- LPV Rate baixa → sugerir otimização de landing page
- ROAS baixo → sugerir revisão de funil completo
- Pacing atrasado → sugerir ajuste de orçamento

Sempre responda em português do Brasil. Seja específico e acionável.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { metrics, drivers, alerts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userContent = `Analise estas métricas e gere recomendações de melhoria:

MÉTRICAS ATUAIS:
${JSON.stringify(metrics, null, 2)}

${drivers ? `DRIVERS DE MUDANÇA:\n${JSON.stringify(drivers, null, 2)}` : ''}

${alerts ? `ALERTAS ATIVOS:\n${JSON.stringify(alerts, null, 2)}` : ''}

Gere entre 3 e 6 recomendações priorizadas.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_recommendations",
            description: "Gera lista de recomendações acionáveis para melhorar performance de campanhas",
            parameters: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Título curto da recomendação" },
                      priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                      category: { type: "string", enum: ["criativo", "público", "orçamento", "landing_page", "funil", "posicionamento"] },
                      why: { type: "string", description: "Por que essa ação é necessária" },
                      what_to_do: { type: "string", description: "O que fazer concretamente" },
                      expected_impact: { type: "string", description: "Impacto esperado da ação" },
                      confidence: { type: "number", description: "Confiança de 0 a 1" },
                    },
                    required: ["title", "priority", "category", "why", "what_to_do", "expected_impact", "confidence"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["recommendations"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_recommendations" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: return raw content
    return new Response(JSON.stringify({ 
      recommendations: [],
      raw: data.choices?.[0]?.message?.content 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommendations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
