import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um analista sênior de tráfego pago que escreve relatórios executivos para clientes.
Seu tom é profissional mas acessível — escreva como se estivesse falando com o diretor de marketing.

Regras:
- Português do Brasil
- Seja conciso e direto (máximo 3-4 parágrafos por seção)
- Use números e porcentagens do contexto fornecido
- Não invente dados — use APENAS os dados fornecidos
- Formate texto puro (sem markdown, o resultado vai para PDF)`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { metricsContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `Com base nos dados abaixo, gere EXATAMENTE 3 seções de relatório executivo em JSON.

DADOS DO PERÍODO:
${JSON.stringify(metricsContext, null, 2)}

Responda SOMENTE com o JSON, sem nenhum texto extra.`;

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
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_report_sections",
              description: "Gera 3 seções narrativas para relatório executivo de Meta Ads.",
              parameters: {
                type: "object",
                properties: {
                  o_que_mudou: {
                    type: "string",
                    description: "Seção 'O que mudou': descreva as variações mais relevantes do período comparado ao anterior. Cite métricas específicas com valores e porcentagens de variação. 3-4 parágrafos."
                  },
                  por_que: {
                    type: "string",
                    description: "Seção 'Por quê': identifique os principais drivers das mudanças. Relacione causa-efeito entre métricas (ex: aumento de CPM causou aumento de CPA). 2-3 parágrafos."
                  },
                  o_que_faremos: {
                    type: "string",
                    description: "Seção 'O que faremos': liste 3-5 recomendações priorizadas com ações concretas e impacto esperado. 3-4 parágrafos."
                  },
                },
                required: ["o_que_mudou", "por_que", "o_que_faremos"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_report_sections" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
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
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou seções estruturadas" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sections = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(sections), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report narrative error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
