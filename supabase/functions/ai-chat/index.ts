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
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    let systemPrompt = SYSTEM_PROMPT;
    if (metricsContext) {
      systemPrompt += `\n\nContexto atual das métricas do usuário:\n${JSON.stringify(metricsContext, null, 2)}`;
    }

    // Convert messages: Anthropic expects no "system" role in messages array
    const anthropicMessages = messages
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

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
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na API da Anthropic" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream Anthropic SSE directly to client
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
