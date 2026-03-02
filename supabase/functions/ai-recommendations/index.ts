import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um analista especialista em performance de mídia paga, com foco em Meta Ads (Facebook e Instagram). Você trabalha para a agência bwild e gera recomendações acionáveis de melhoria.

## SEU PAPEL
Você é objetivo, direto e orientado a resultados. Analise os dados reais fornecidos e gere recomendações concretas.

## CRITÉRIOS DE ANÁLISE
- CPA acima de benchmark → sugerir otimização de público ou criativo
- CTR baixo (<1,5% feed, <0,8% stories) → sugerir revisão de copy/criativo
- Frequência alta (>3,5) → sugerir expansão de público ou renovação de criativos
- CPM subindo (>R$25) → sugerir diversificação de posicionamento
- LPV Rate baixa → sugerir otimização de landing page
- ROAS baixo (<3x e-commerce, <5x performance) → sugerir revisão de funil completo
- Pacing atrasado → sugerir ajuste de orçamento

## BENCHMARKS DE REFERÊNCIA (Meta Ads)
- ROAS saudável: acima de 3x (e-commerce), acima de 5x (performance)
- CPA: compare sempre com o CPA histórico da conta
- CTR saudável: acima de 1,5% (feed), acima de 0,8% (stories)
- Frequência: acima de 3,5 = sinal de fadiga criativa
- CPM elevado: acima de R$25 merece atenção

## TIPOS DE AÇÃO
"Escalar", "Pausar", "Revisar Criativo", "Expandir Público", "Ajustar Orçamento", "Otimizar Landing Page"

## RESTRIÇÕES
- Nunca invente dados
- Sempre responda em português brasileiro
- Seja específico e acionável
- Classifique cada recomendação com score de urgência 0-100`;

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
