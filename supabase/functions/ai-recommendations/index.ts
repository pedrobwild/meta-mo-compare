import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um consultor sênior de performance em tráfego pago. 
Analise os dados de métricas fornecidos e gere recomendações acionáveis de melhoria.

Critérios de análise:
- CPA acima de benchmark → sugerir otimização de público ou criativo
- CTR baixo (<1%) → sugerir revisão de copy/criativo
- Frequência alta (>3) → sugerir expansão de público ou renovação de criativos
- CPM subindo → sugerir diversificação de posicionamento
- LPV Rate baixa → sugerir otimização de landing page
- ROAS baixo → sugerir revisão de funil completo
- Pacing atrasado → sugerir ajuste de orçamento

Tipos de ação disponíveis: "Escalar", "Pausar", "Revisar Criativo", "Expandir Público", "Ajustar Orçamento", "Otimizar Landing Page"

Sempre responda em português do Brasil. Seja específico e acionável.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { metrics, drivers, alerts, topCampaigns } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const userContent = `Analise estas métricas e gere recomendações de melhoria:

MÉTRICAS ATUAIS:
${JSON.stringify(metrics, null, 2)}

${drivers ? `DRIVERS DE MUDANÇA:\n${JSON.stringify(drivers, null, 2)}` : ''}

${alerts ? `ALERTAS ATIVOS:\n${JSON.stringify(alerts, null, 2)}` : ''}

${topCampaigns ? `TOP 5 CAMPANHAS:\n${JSON.stringify(topCampaigns, null, 2)}` : ''}

Gere entre 3 e 6 recomendações priorizadas. Use a tool "generate_recommendations".`;

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
        messages: [{ role: "user", content: userContent }],
        tools: [{
          name: "generate_recommendations",
          description: "Gera lista de recomendações acionáveis para melhorar performance de campanhas",
          input_schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Título curto da recomendação" },
                    action_type: { type: "string", enum: ["Escalar", "Pausar", "Revisar Criativo", "Expandir Público", "Ajustar Orçamento", "Otimizar Landing Page"], description: "Tipo de ação" },
                    priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                    category: { type: "string", enum: ["criativo", "público", "orçamento", "landing_page", "funil", "posicionamento"] },
                    why: { type: "string", description: "Por que essa ação é necessária" },
                    what_to_do: { type: "string", description: "O que fazer concretamente" },
                    expected_impact: { type: "string", description: "Impacto esperado da ação" },
                    confidence: { type: "number", description: "Confiança de 0 a 1" },
                    score: { type: "integer", description: "Score de urgência de 0 a 100" },
                  },
                  required: ["title", "action_type", "priority", "category", "why", "what_to_do", "expected_impact", "confidence", "score"],
                }
              }
            },
            required: ["recommendations"],
          }
        }],
        tool_choice: { type: "tool", name: "generate_recommendations" },
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

    return new Response(JSON.stringify({ 
      recommendations: [],
      raw: data.content?.[0]?.text 
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
