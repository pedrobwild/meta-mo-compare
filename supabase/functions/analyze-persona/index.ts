import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { workspace_id, persona_id, mode } = await req.json();

    if (!workspace_id) throw new Error('workspace_id required');

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    // Fetch all data in parallel
    const [personasRes, demosRes, devicesRes, citiesRes] = await Promise.all([
      supabase.from('persona_profiles').select('*').eq('workspace_id', workspace_id),
      supabase.from('audience_demographics').select('*').eq('workspace_id', workspace_id).gte('date', ninetyDaysAgo).limit(500),
      supabase.from('audience_device_data').select('*').eq('workspace_id', workspace_id).gte('date', ninetyDaysAgo).limit(200),
      supabase.from('audience_demographics').select('city,region,leads,spend,revenue').eq('workspace_id', workspace_id).gte('date', ninetyDaysAgo).neq('city', '').order('leads', { ascending: false }).limit(20),
    ]);

    const personas = personasRes.data || [];
    const demos = demosRes.data || [];
    const devices = devicesRes.data || [];
    const cities = citiesRes.data || [];

    // Aggregate age×gender for prompt
    const ageGenderAgg: Record<string, any> = {};
    for (const d of demos.filter(d => d.age_range)) {
      const key = `${d.age_range}|${d.gender}`;
      if (!ageGenderAgg[key]) ageGenderAgg[key] = { age: d.age_range, gender: d.gender, leads: 0, spend: 0, impressions: 0, clicks: 0 };
      ageGenderAgg[key].leads += Number(d.leads || 0);
      ageGenderAgg[key].spend += Number(d.spend || 0);
      ageGenderAgg[key].impressions += Number(d.impressions || 0);
      ageGenderAgg[key].clicks += Number(d.clicks || 0);
    }

    // Aggregate devices
    const deviceAgg: Record<string, any> = {};
    for (const d of devices) {
      const key = `${d.device_type}|${d.platform}`;
      if (!deviceAgg[key]) deviceAgg[key] = { device: d.device_type, platform: d.platform, leads: 0, impressions: 0, clicks: 0 };
      deviceAgg[key].leads += Number(d.leads || 0);
      deviceAgg[key].impressions += Number(d.impressions || 0);
      deviceAgg[key].clicks += Number(d.clicks || 0);
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === 'specific' && persona_id) {
      const persona = personas.find(p => p.id === persona_id);
      if (!persona) throw new Error('Persona not found');

      systemPrompt = 'Você é um analista sênior de performance marketing da agência bwild. Aprofunde a análise de uma persona específica.';
      userPrompt = `Aprofunde a análise da persona "${persona.name}".

PERFIL:
${JSON.stringify(persona, null, 2)}

DADOS DEMOGRÁFICOS (90 dias):
${JSON.stringify(Object.values(ageGenderAgg), null, 2)}

DISPOSITIVOS:
${JSON.stringify(Object.values(deviceAgg), null, 2)}

TOP CIDADES:
${JSON.stringify(cities.slice(0, 10), null, 2)}

OUTRAS PERSONAS:
${JSON.stringify(personas.filter(p => p.id !== persona_id).map(p => ({ name: p.name, cpl: p.avg_cpl, leads: p.total_leads, roas: p.roas_real })), null, 2)}

Responda em português brasileiro:
1. Descrição narrativa (briefing para equipe de vendas)
2. Ângulos de criativo que mais ressoam
3. Principais objeções e como contornar
4. Como aumentar volume dessa persona
5. Red flags de leads que não vão converter`;
    } else {
      systemPrompt = 'Você é um analista sênior de performance marketing da agência bwild. Analise os dados demográficos e construa perfis de personas.';
      userPrompt = `Analise os dados demográficos e comportamentais dos leads/clientes.

DADOS POR IDADE E GÊNERO (90 dias):
${JSON.stringify(Object.values(ageGenderAgg), null, 2)}

TOP CIDADES:
${JSON.stringify(cities.slice(0, 10), null, 2)}

DISPOSITIVOS:
${JSON.stringify(Object.values(deviceAgg), null, 2)}

PERSONAS JÁ IDENTIFICADAS:
${JSON.stringify(personas.map(p => ({ name: p.name, age: p.age_range, gender: p.gender, cpl: p.avg_cpl, leads: p.total_leads, roas: p.roas_real, cities: p.top_cities })), null, 2)}

Responda em português brasileiro:
1. PERSONAS IDENTIFICADAS (2-3): perfil detalhado, comportamento, dores, motivações
2. INSIGHTS ESTRATÉGICOS: maior LTV, mais fácil converter, subestimada, pior CAC
3. RECOMENDAÇÕES DE SEGMENTAÇÃO: públicos para criar/escalar/pausar
4. OPORTUNIDADES NÃO EXPLORADAS: segmentos com potencial`;
    }

    // Stream from Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API error: ${claudeRes.status} - ${errText}`);
    }

    return new Response(claudeRes.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (e) {
    console.error('analyze-persona error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
