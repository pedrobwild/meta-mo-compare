import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um analista especialista em performance de mídia paga, com foco em Meta Ads (Facebook e Instagram). Você trabalha para a agência bwild e escreve relatórios executivos para clientes.

Seu tom é profissional mas acessível — escreva como se estivesse falando com o diretor de marketing.

## BENCHMARKS DE REFERÊNCIA (Meta Ads)
- ROAS saudável: acima de 3x (e-commerce), acima de 5x (performance)
- CTR saudável: acima de 1,5% (feed), acima de 0,8% (stories)
- Frequência: acima de 3,5 = sinal de fadiga criativa
- CPM elevado: acima de R$25 merece atenção

## RESTRIÇÕES
- Português do Brasil
- Seja conciso e direto (máximo 3-4 parágrafos por seção)
- Use números e porcentagens do contexto fornecido
- Não invente dados — use APENAS os dados fornecidos
- Formate texto puro (sem markdown, o resultado vai para PDF)
- Nunca use linguagem vaga como "pode ser interessante considerar"
- Sempre termine cada seção com uma ação clara e objetiva`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { metricsContext } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const userPrompt = `Com base nos dados abaixo, gere EXATAMENTE 3 seções de relatório executivo.

DADOS DO PERÍODO:
${JSON.stringify(metricsContext, null, 2)}

Use a tool "generate_report_sections" para retornar as 3 seções.`;

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
            description: "Gera 3 seções narrativas para relatório executivo de Meta Ads.",
            input_schema: {
              type: "object",
              properties: {
                o_que_mudou: {
                  type: "string",
                  description: "Seção 'O que mudou': variações relevantes do período com métricas e porcentagens. 3-4 parágrafos."
                },
                por_que: {
                  type: "string",
                  description: "Seção 'Por quê': principais drivers das mudanças. Causa-efeito entre métricas. 2-3 parágrafos."
                },
                o_que_faremos: {
                  type: "string",
                  description: "Seção 'O que faremos': 3-5 recomendações priorizadas com ações concretas e impacto. 3-4 parágrafos."
                },
              },
              required: ["o_que_mudou", "por_que", "o_que_faremos"],
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
