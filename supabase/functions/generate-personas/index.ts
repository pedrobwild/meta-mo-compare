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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get workspace from body or first available
    let workspace_id: string;
    try {
      const body = await req.json();
      workspace_id = body.workspace_id;
    } catch {
      const { data: ws } = await supabase.from('workspaces').select('id').limit(1);
      workspace_id = ws?.[0]?.id;
    }
    if (!workspace_id) throw new Error('No workspace found');

    // 1. Aggregate demographics by age_range + gender (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
    
    const { data: demos } = await supabase
      .from('audience_demographics')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('source', 'meta_ads')
      .gte('date', ninetyDaysAgo)
      .neq('age_range', '');

    if (!demos?.length) {
      return new Response(JSON.stringify({ success: true, message: 'No demographic data to generate personas' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group by age_range + gender
    const groups: Record<string, { leads: number; spend: number; impressions: number; clicks: number; revenue: number; conversions: number }> = {};
    for (const d of demos) {
      const key = `${d.age_range}|${d.gender}`;
      if (!groups[key]) groups[key] = { leads: 0, spend: 0, impressions: 0, clicks: 0, revenue: 0, conversions: 0 };
      groups[key].leads += Number(d.leads || 0);
      groups[key].spend += Number(d.spend || 0);
      groups[key].impressions += Number(d.impressions || 0);
      groups[key].clicks += Number(d.clicks || 0);
      groups[key].revenue += Number(d.revenue || 0);
      groups[key].conversions += Number(d.conversions || 0);
    }

    // Score each group: lower CPL + higher conversion rate = better
    const scored = Object.entries(groups)
      .filter(([_, v]) => v.leads > 0)
      .map(([key, v]) => {
        const [age_range, gender] = key.split('|');
        const cpl = v.spend / v.leads;
        const convRate = v.leads > 0 ? (v.conversions / v.leads) * 100 : 0;
        // Score: inverse CPL * conversion rate (higher is better)
        const score = cpl > 0 ? (convRate + 1) / cpl * 100 : 0;
        return { age_range, gender, ...v, cpl, convRate, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    // Get top cities per group
    const { data: cityDemos } = await supabase
      .from('audience_demographics')
      .select('city, leads, spend')
      .eq('workspace_id', workspace_id)
      .eq('source', 'meta_ads')
      .gte('date', ninetyDaysAgo)
      .neq('city', '')
      .order('leads', { ascending: false })
      .limit(20);

    const topCities = [...new Set((cityDemos || []).map(c => c.city))].slice(0, 5);

    // Get device/placement data
    const { data: devices } = await supabase
      .from('audience_device_data')
      .select('placement, leads, cpl')
      .eq('workspace_id', workspace_id)
      .gte('date', ninetyDaysAgo)
      .order('leads', { ascending: false })
      .limit(10);

    const bestPlacement = devices?.[0]?.placement || 'feed';

    // Build persona profiles
    const personas = scored.map((g, i) => {
      const genderLabel = g.gender === 'male' ? 'Masculino' : g.gender === 'female' ? 'Feminino' : 'Todos';
      const name = `Persona ${i + 1}: ${genderLabel} ${g.age_range}`;
      
      return {
        workspace_id,
        name,
        description: '',
        age_range: g.age_range,
        gender: g.gender,
        top_cities: topCities,
        top_interests: [] as string[],
        avg_cpl: Math.round(g.cpl * 100) / 100,
        avg_mql_rate: g.leads > 0 ? Math.round((g.conversions / g.leads) * 10000) / 100 : 0,
        avg_sql_rate: 0,
        avg_close_rate: 0,
        avg_deal_value: g.conversions > 0 ? Math.round((g.revenue / g.conversions) * 100) / 100 : 0,
        best_performing_creative_angle: null,
        best_performing_placement: bestPlacement,
        best_day_of_week: null,
        best_hour_of_day: null,
        total_leads: g.leads,
        total_revenue: g.revenue,
        roas_real: g.spend > 0 ? Math.round((g.revenue / g.spend) * 100) / 100 : 0,
      };
    });

    // Generate descriptions with Claude if available
    if (ANTHROPIC_API_KEY && personas.length > 0) {
      try {
        const prompt = `Analise os dados demográficos destes ${personas.length} perfis de persona de comprador e gere uma descrição narrativa curta (3-4 frases) para cada um, em português brasileiro.

Dados:
${JSON.stringify(personas.map(p => ({ name: p.name, age_range: p.age_range, gender: p.gender, cpl: p.avg_cpl, leads: p.total_leads, revenue: p.total_revenue, roas: p.roas_real, top_cities: p.top_cities, placement: p.best_performing_placement })), null, 2)}

Responda APENAS com um JSON array de strings, uma descrição por persona na mesma ordem. Sem markdown.`;

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          const text = claudeData.content?.[0]?.text || '';
          try {
            const descriptions = JSON.parse(text);
            descriptions.forEach((desc: string, i: number) => {
              if (personas[i]) personas[i].description = desc;
            });
          } catch { /* keep empty descriptions */ }
        }
      } catch (e) {
        console.error('Claude description generation failed:', e);
      }
    }

    // Delete old personas and insert new
    await supabase.from('persona_profiles').delete().eq('workspace_id', workspace_id);
    
    const { error } = await supabase.from('persona_profiles').insert(personas);
    if (error) throw error;

    console.log(`Generated ${personas.length} personas for workspace ${workspace_id}`);

    return new Response(JSON.stringify({ success: true, personas: personas.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('generate-personas error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
