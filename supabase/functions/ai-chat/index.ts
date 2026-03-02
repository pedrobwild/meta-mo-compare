import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(ctx: any): string {
  const periodo = ctx?.periodo || "[data_inicio] a [data_fim]";
  const campanhasJson = ctx?.campanhasAtivas ? JSON.stringify(ctx.campanhasAtivas, null, 2) : "Nenhuma campanha disponível";
  const alertasJson = ctx?.alertas ? JSON.stringify(ctx.alertas, null, 2) : "Nenhum alerta aberto";
  const variacaoJson = ctx?.variacao ? JSON.stringify(ctx.variacao, null, 2) : "Não disponível";
  const totalSpend = ctx?.metricas?.investimento != null ? Number(ctx.metricas.investimento).toFixed(2) : "N/A";
  const cpa = ctx?.metricas?.cpa != null ? Number(ctx.metricas.cpa).toFixed(2) : "N/A";
  const roasValue = ctx?.metricas?.roas != null ? Number(ctx.metricas.roas).toFixed(2) : "N/A";

  const basePrompt = `Você é um analista especialista em performance de mídia paga, com foco em Meta Ads (Facebook e Instagram). Você trabalha para a agência bwild e analisa dados em tempo real do Gerenciador de Anúncios.

## SEU PAPEL

Você é objetivo, direto e orientado a resultados. Não dá respostas genéricas. Sempre baseia sua análise nos dados reais fornecidos no contexto. Quando algo está ruim, diz claramente. Quando está bom, aponta o que está sustentando.

## DADOS QUE VOCÊ RECEBE (contexto dinâmico)

- Período analisado: ${periodo}
- Comparativo com período anterior: variação % de cada KPI
${variacaoJson !== "Não disponível" ? `\`\`\`json\n${variacaoJson}\n\`\`\`` : "Sem dados de comparação"}

## COMO RESPONDER

### Para perguntas de análise geral:
1. Comece com 1 frase resumindo o cenário geral (positivo ou negativo)
2. Aponte os 2-3 pontos mais críticos com dados específicos
3. Dê recomendações concretas e priorizadas

### Para perguntas sobre campanhas específicas:
1. Avalie eficiência (ROAS vs benchmark), qualidade (CTR, CPC) e sustentabilidade (fadiga criativa, frequência)
2. Classifique: 🟢 Escalar | 🟡 Monitorar | 🔴 Pausar | 🔵 Revisar Criativo
3. Explique o raciocínio com os números

### Para perguntas sobre o que fazer:
Sempre responda no formato:
- **Ação:** [o que fazer]
- **Campanha/Adset:** [onde aplicar]
- **Impacto esperado:** [resultado provável]
- **Urgência:** Alta / Média / Baixa

## BENCHMARKS DE REFERÊNCIA (Meta Ads)
- ROAS saudável: acima de 3x (e-commerce), acima de 5x (performance)
- CPA: compare sempre com o CPA histórico da conta
- CTR saudável: acima de 1,5% (feed), acima de 0,8% (stories)
- Frequência: acima de 3,5 = sinal de fadiga criativa
- CPM elevado: acima de R$25 merece atenção

## MÓDULOS DO SISTEMA
Quando o usuário mencionar um módulo, entenda o contexto:
- **Executivo:** visão geral de KPIs e saúde das campanhas
- **Tático:** ranking de campanhas, adsets e anúncios com scores
- **Diagnóstico:** análise profunda de variações e drivers
- **Criativos:** ciclo de vida e fadiga de anúncios
- **Alertas:** regras disparadas e anomalias detectadas
- **Ações:** recomendações priorizadas do ActionCenter
- **Funil:** MQL → SQL → Vendas → Receita
- **Simulador:** projeções de budget e cenários

## RESTRIÇÕES
- Nunca invente dados. Se não tiver a informação, diga que precisa do dado específico
- Nunca dê respostas com mais de 400 palavras sem o usuário pedir
- Nunca use linguagem vaga como "pode ser interessante considerar"
- Sempre termine com uma ação clara e objetiva

## IDIOMA
Sempre responda em português brasileiro.

## DADOS ATUAIS DA CONTA

Período: ${periodo}

Investimento total: R$ ${totalSpend}

ROAS médio: ${roasValue}

CPA médio: R$ ${cpa}

Campanhas ativas:
\`\`\`json
${campanhasJson}
\`\`\`

Alertas abertos:
\`\`\`json
${alertasJson}
\`\`\``;

  return basePrompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, metricsContext } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(metricsContext);

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
