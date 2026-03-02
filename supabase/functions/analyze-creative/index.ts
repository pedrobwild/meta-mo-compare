import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, creativeData, portfolioData, workspaceId } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    let userPrompt = "";

    if (mode === "individual" && creativeData) {
      const c = creativeData;
      const isPartnership = c.is_partnership ? "\n⚠️ Este é um Partnership Ad (co-criado com criador/parceiro). Partnership Ads performam em média 13% melhor em CTR e 19% melhor em CPA." : "";
      userPrompt = `Analise a performance deste criativo do Meta Ads da bwild e dê uma recomendação clara.

CRIATIVO:
Nome: ${c.ad_name}
Ângulo: ${c.angle || "Não definido"}
Hook: ${c.hook || "Não definido"}
CTA: ${c.cta || "Não definido"}
Tipo: ${c.creative_type || "Não definido"}
Dias no ar: ${c.days_active}
Estágio atual: ${c.lifecycle_stage}${isPartnership}

MÉTRICAS HISTÓRICAS (dia a dia, últimos 14 dias):
${JSON.stringify(c.daily_metrics || [], null, 2)}

MÉDIAS DA CONTA (referência):
- CTR médio: ${c.account_avg_ctr?.toFixed(2) || "N/A"}%
- CPL médio: R$ ${c.account_avg_cpl?.toFixed(2) || "N/A"}
- Frequência média: ${c.account_avg_freq?.toFixed(2) || "N/A"}
- CPL meta: R$ ${c.cpl_meta?.toFixed(2) || "N/A"}
- ThruPlay Rate médio: ${c.thruplay_rate?.toFixed(2) || "N/A"}%

BENCHMARKS INTERNOS (Guia de Bordo bwild):
- CTR saudável: > 1,2% (feed)
- Frequência máxima prospecting: 2,5 (7 dias)
- CVR LP saudável: > 10%
- ThruPlay Rate saudável: > 15% (métrica principal de vídeo 2026)
- Regra: pausar se CPL > 1,5× meta e gasto ≥ 1× CPL meta

Responda:
1. Diagnóstico: o que os dados indicam sobre este criativo?
2. Causa provável do estágio atual (fatigado/declinando/escalando)
3. Ação recomendada agora (com urgência: Alta/Média/Baixa)
4. Sugestão de próximo criativo a testar (ângulo, hook, variação)
5. Se vídeo: análise de ThruPlay Rate e recomendação de hook`;
    } else if (mode === "portfolio" && portfolioData) {
      const p = portfolioData;
      userPrompt = `Analise o portfólio completo de criativos ativos da conta bwild e gere recomendações estratégicas.

RESUMO DO PORTFÓLIO:
Total de criativos: ${p.total}
Em Peaking: ${p.peaking_count}
Em Declining: ${p.declining_count}
Em Fatigued: ${p.fatigued_count}
Em Fresh: ${p.fresh_count}
Partnership Ads: ${p.partnership_count || 0}

CRIATIVOS POR ÂNGULO:
${JSON.stringify(p.angles || [], null, 2)}

TOP 3 CRIATIVOS (melhor CTR/CPL):
${JSON.stringify(p.top_creatives || [], null, 2)}

PIORES 3 CRIATIVOS (pior CTR/CPL):
${JSON.stringify(p.worst_creatives || [], null, 2)}

ÚLTIMOS 30 DIAS DA CONTA:
- CTR médio: ${p.avg_ctr?.toFixed(2) || "N/A"}%
- CPL médio: R$ ${p.avg_cpl?.toFixed(2) || "N/A"}
- Frequência média: ${p.avg_freq?.toFixed(2) || "N/A"}
- Criativos pausados por fadiga: ${p.paused_count || 0}

Com base no Guia de Bordo bwild:
- Rotacionar 2–3 novas peças/semana para evitar fadiga
- Testar 1 variável por vez
- Ângulos: dor, prova social, autoridade, oferta, demonstração
- Partnership Ads performam ~13% melhor em CTR (considerar no mix)
- ThruPlay Rate > 15% = bom engajamento de vídeo (métrica 2026)

Responda:
1. Saúde geral do portfólio de criativos (1 parágrafo)
2. Qual ângulo está performando melhor e por quê
3. Quais criativos pausar agora (lista com motivo)
4. Quais criativos escalar agora (lista com motivo)
5. Sugestão de 3 novos criativos para testar (ângulo + hook + variável a testar)
6. Risco identificado no portfólio atual
7. Recomendação sobre Partnership Ads se aplicável`;
    } else {
      throw new Error("Invalid mode or missing data");
    }

    const systemPrompt = `Você é um analista sênior de tráfego pago da agência bwild, especialista em Meta Ads. Analise os dados fornecidos com base no Guia de Bordo interno da bwild. Seja objetivo, direto e orientado a resultados. Nunca dê respostas genéricas. Sempre baseie na análise nos dados reais. Quando algo está ruim, diga claramente com o número. Responda em português brasileiro. Máximo 400 palavras.

MUDANÇAS META 2026: ThruPlay é a métrica principal de vídeo (substitui 10-second views). Atribuição: 7d click / 1d view. Partnership Ads +13% CTR. Advantage+ é a estrutura padrão.`;

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
      console.error("Anthropic API error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI API error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-creative error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
