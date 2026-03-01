import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um analista senior de tráfego pago especializado em Meta Ads (Facebook/Instagram Ads).
Seu papel é ajudar gestores de tráfego a analisar performance, otimizar campanhas e tomar decisões baseadas em dados.

Conhecimentos:
- Métricas: CPM, CPC, CTR, CPA, ROAS, Frequência, LPV Rate, Custo por LPV
- Funil: Impressões → Cliques → LPV → Leads → MQL → SQL → Vendas → Receita
- Otimização: bidding, públicos, criativos, posicionamentos, orçamento
- Diagnóstico: fadiga de criativo, saturação de audiência, sazonalidade
- Benchmarks do mercado brasileiro

Regras:
- Responda sempre em português do Brasil
- Seja direto e acionável
- Quando possível, sugira ações concretas com impacto esperado
- Use dados fornecidos pelo usuário para contextualizar análises
- Formate com markdown para melhor legibilidade`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, metricsContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];
    
    if (metricsContext) {
      systemMessages.push({
        role: "system",
        content: `Contexto atual das métricas do usuário:\n${JSON.stringify(metricsContext, null, 2)}`
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [...systemMessages, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
