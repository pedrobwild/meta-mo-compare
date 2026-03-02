import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Users, Star, MapPin, Smartphone, Monitor, Tablet, RefreshCw, Brain, TrendingUp, Target, ArrowRight, Clock, Loader2, BarChart3, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown';

// ─── Types ───

interface Persona {
  id: string;
  name: string;
  description: string;
  age_range: string;
  gender: string;
  top_cities: string[];
  top_interests: string[];
  avg_cpl: number;
  avg_mql_rate: number;
  avg_sql_rate: number;
  avg_close_rate: number;
  avg_deal_value: number;
  best_performing_creative_angle: string | null;
  best_performing_placement: string | null;
  best_day_of_week: string | null;
  best_hour_of_day: number | null;
  total_leads: number;
  total_revenue: number;
  roas_real: number;
  created_at: string;
}

interface DemoRow {
  age_range: string;
  gender: string;
  country: string;
  city: string;
  region: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  mql: number;
  revenue: number;
}

interface DeviceRow {
  device_type: string;
  platform: string;
  placement: string;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number;
  ctr: number;
}

// ─── Helpers ───

const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n);
const fmtCurrency = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${fmt(n)}%`;

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(330, 60%, 55%)',
  'hsl(var(--muted-foreground))',
  'hsl(200, 60%, 50%)',
  'hsl(150, 50%, 45%)',
  'hsl(40, 70%, 55%)',
];

// ─── Main Component ───

export default function PersonaAudienceView() {
  const { workspace } = useWorkspace();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [demos, setDemos] = useState<DemoRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [demoMetric, setDemoMetric] = useState<'leads' | 'spend' | 'clicks'>('leads');

  const loadData = useCallback(async () => {
    if (!workspace?.id) return;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];

    const [personasRes, demosRes, devicesRes] = await Promise.all([
      supabase.from('persona_profiles').select('*').eq('workspace_id', workspace.id).order('total_leads', { ascending: false }),
      supabase.from('audience_demographics').select('age_range,gender,country,city,region,impressions,clicks,spend,leads,mql,revenue').eq('workspace_id', workspace.id).gte('date', ninetyDaysAgo).limit(1000),
      supabase.from('audience_device_data').select('device_type,platform,placement,impressions,clicks,leads,cpl,ctr').eq('workspace_id', workspace.id).gte('date', ninetyDaysAgo).limit(500),
    ]);

    setPersonas((personasRes.data || []) as Persona[]);
    setDemos((demosRes.data || []) as DemoRow[]);
    setDevices((devicesRes.data || []) as DeviceRow[]);
  }, [workspace?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-audience-demographics');
      if (error) throw error;
      toast.success(`Sincronizado: ${data.demographics} demográficos, ${data.devices} dispositivos`);
      await loadData();
    } catch (e: any) {
      toast.error(`Erro na sincronização: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerate = async () => {
    if (!workspace?.id) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-personas', {
        body: { workspace_id: workspace.id },
      });
      if (error) throw error;
      toast.success(`${data.personas} personas geradas com sucesso`);
      await loadData();
    } catch (e: any) {
      toast.error(`Erro ao gerar personas: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleAnalyze = async (mode: 'general' | 'specific', personaId?: string) => {
    if (!workspace?.id) return;
    setAnalyzing(true);
    setAnalysisText('');
    setSelectedPersonaId(personaId || null);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-persona`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ workspace_id: workspace.id, mode, persona_id: personaId }),
      });

      if (!response.ok) throw new Error('Erro na análise');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.delta?.text || parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              setAnalysisText(fullText);
            }
          } catch { /* partial */ }
        }
      }
    } catch (e: any) {
      toast.error(`Erro na análise: ${e.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // ─── Aggregated data for charts ───

  const ageGenderData = (() => {
    const agg: Record<string, Record<string, number>> = {};
    for (const d of demos.filter(d => d.age_range)) {
      if (!agg[d.age_range]) agg[d.age_range] = { male: 0, female: 0, unknown: 0 };
      const g = d.gender === 'male' ? 'male' : d.gender === 'female' ? 'female' : 'unknown';
      agg[d.age_range][g] += Number(d[demoMetric] || 0);
    }
    return Object.entries(agg).map(([age, v]) => ({ age, Masculino: v.male, Feminino: v.female, Outro: v.unknown }));
  })();

  const cityData = (() => {
    const agg: Record<string, { leads: number; spend: number; mql: number; revenue: number }> = {};
    for (const d of demos.filter(d => d.city)) {
      if (!agg[d.city]) agg[d.city] = { leads: 0, spend: 0, mql: 0, revenue: 0 };
      agg[d.city].leads += Number(d.leads || 0);
      agg[d.city].spend += Number(d.spend || 0);
      agg[d.city].mql += Number(d.mql || 0);
      agg[d.city].revenue += Number(d.revenue || 0);
    }
    return Object.entries(agg)
      .map(([city, v]) => ({
        city,
        ...v,
        cpl: v.leads > 0 ? v.spend / v.leads : 0,
        mqlRate: v.leads > 0 ? (v.mql / v.leads) * 100 : 0,
        roas: v.spend > 0 ? v.revenue / v.spend : 0,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10);
  })();

  const deviceData = (() => {
    const agg: Record<string, { leads: number; impressions: number; clicks: number; spend: number }> = {};
    for (const d of devices) {
      const key = d.device_type || 'unknown';
      if (!agg[key]) agg[key] = { leads: 0, impressions: 0, clicks: 0, spend: 0 };
      agg[key].leads += Number(d.leads || 0);
      agg[key].impressions += Number(d.impressions || 0);
      agg[key].clicks += Number(d.clicks || 0);
    }
    return Object.entries(agg).map(([name, v]) => ({ name, value: v.leads, ...v }));
  })();

  const platformData = (() => {
    const agg: Record<string, { leads: number; impressions: number; clicks: number; ctr: number }> = {};
    for (const d of devices) {
      const key = `${d.platform} ${d.placement}`.trim() || 'other';
      if (!agg[key]) agg[key] = { leads: 0, impressions: 0, clicks: 0, ctr: 0 };
      agg[key].leads += Number(d.leads || 0);
      agg[key].impressions += Number(d.impressions || 0);
      agg[key].clicks += Number(d.clicks || 0);
    }
    return Object.entries(agg)
      .map(([name, v]) => ({ name, ...v, ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0 }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 8);
  })();

  const totalDeviceLeads = deviceData.reduce((s, d) => s + d.value, 0);

  const hasData = demos.length > 0 || devices.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-meta-title text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" strokeWidth={1.5} />
            Persona & Audiência
          </h2>
          <p className="text-meta-body text-muted-foreground">Análise inteligente do perfil dos seus clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="rounded-meta-btn">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {syncing ? 'Sincronizando...' : 'Sync Demográfico'}
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating || !hasData} className="rounded-meta-btn">
            <Sparkles className={`h-3.5 w-3.5 mr-1.5 ${generating ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {generating ? 'Gerando...' : 'Gerar Personas'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="personas" className="space-y-4">
        <TabsList className="bg-muted rounded-meta-card">
          <TabsTrigger value="personas" className="rounded-meta-btn text-meta-label">Personas</TabsTrigger>
          <TabsTrigger value="demographics" className="rounded-meta-btn text-meta-label">Demográficos</TabsTrigger>
          <TabsTrigger value="devices" className="rounded-meta-btn text-meta-label">Dispositivos</TabsTrigger>
          <TabsTrigger value="journey" className="rounded-meta-btn text-meta-label">Jornada</TabsTrigger>
          <TabsTrigger value="lookalike" className="rounded-meta-btn text-meta-label">Lookalike</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Personas ─── */}
        <TabsContent value="personas" className="space-y-4">
          {personas.length === 0 ? (
            <Card className="border-border rounded-meta-card">
              <CardContent className="py-12 text-center space-y-3">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />
                <p className="text-meta-heading-sm text-foreground">Nenhuma persona identificada</p>
                <p className="text-meta-body text-muted-foreground">Sincronize os dados demográficos e clique em "Gerar Personas"</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {personas.map((p, i) => (
                  <Card key={p.id} className="border-border rounded-meta-card hover:shadow-meta-card transition-shadow relative">
                    {i === 0 && (
                      <Badge className="absolute top-3 right-3 bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px]">
                        <Star className="h-3 w-3 mr-1" /> Melhor ROI
                      </Badge>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {p.gender === 'male' ? '♂' : p.gender === 'female' ? '♀' : '◉'}
                        </div>
                        <div>
                          <CardTitle className="text-meta-heading-sm">{p.name}</CardTitle>
                          <CardDescription className="text-meta-caption flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {p.top_cities?.slice(0, 2).join(' · ') || 'N/A'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-meta-caption text-muted-foreground">CPL</p>
                          <p className="text-meta-heading-sm text-foreground">{fmtCurrency(p.avg_cpl)}</p>
                        </div>
                        <div>
                          <p className="text-meta-caption text-muted-foreground">MQL</p>
                          <p className="text-meta-heading-sm text-foreground">{pct(p.avg_mql_rate)}</p>
                        </div>
                        <div>
                          <p className="text-meta-caption text-muted-foreground">ROAS</p>
                          <p className="text-meta-heading-sm text-foreground">{fmt(p.roas_real)}×</p>
                        </div>
                      </div>

                      <Separator className="bg-border" />

                      <div className="space-y-1.5 text-meta-caption text-muted-foreground">
                        <p>🎯 Leads: <span className="text-foreground font-medium">{fmt(p.total_leads)}</span></p>
                        <p>💰 Deal médio: <span className="text-foreground font-medium">{fmtCurrency(p.avg_deal_value)}</span></p>
                        {p.best_performing_placement && (
                          <p>📍 Placement: <span className="text-foreground font-medium">{p.best_performing_placement}</span></p>
                        )}
                      </div>

                      {p.description && (
                        <p className="text-meta-caption text-muted-foreground line-clamp-2 italic">{p.description}</p>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-meta-btn text-meta-caption"
                        onClick={() => handleAnalyze('specific', p.id)}
                        disabled={analyzing}
                      >
                        <Brain className="h-3 w-3 mr-1.5" /> Ver análise completa
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* AI Analysis */}
              <Card className="border-border rounded-meta-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-meta-heading-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" /> Análise IA de Personas
                    </CardTitle>
                    <Button size="sm" variant="outline" onClick={() => handleAnalyze('general')} disabled={analyzing} className="rounded-meta-btn">
                      {analyzing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                      {analyzing ? 'Analisando...' : 'Gerar análise completa'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {analysisText ? (
                    <ScrollArea className="max-h-[500px]">
                      <div className="prose prose-sm max-w-none text-foreground">
                        <ReactMarkdown>{analysisText}</ReactMarkdown>
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-meta-body text-muted-foreground text-center py-6">
                      Clique em "Gerar análise" ou em "Ver análise completa" em uma persona para obter insights do IA Analyst.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─── Tab 2: Demographics ─── */}
        <TabsContent value="demographics" className="space-y-4">
          {/* Age × Gender Chart */}
          <Card className="border-border rounded-meta-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-meta-heading-sm">Idade × Gênero</CardTitle>
                <Select value={demoMetric} onValueChange={(v) => setDemoMetric(v as any)}>
                  <SelectTrigger className="w-28 h-8 rounded-meta-btn text-meta-caption">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leads">Leads</SelectItem>
                    <SelectItem value="spend">Gasto</SelectItem>
                    <SelectItem value="clicks">Cliques</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {ageGenderData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ageGenderData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="age" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    <Bar dataKey="Masculino" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Feminino" fill="hsl(330, 60%, 55%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Outro" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center py-8 text-muted-foreground text-meta-body">Sincronize dados demográficos para ver este gráfico</p>
              )}
            </CardContent>
          </Card>

          {/* Top Cities Table */}
          <Card className="border-border rounded-meta-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-meta-heading-sm">Top Cidades</CardTitle>
            </CardHeader>
            <CardContent>
              {cityData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-meta-caption">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 px-2">Cidade</th>
                        <th className="text-right py-2 px-2">Leads</th>
                        <th className="text-right py-2 px-2">CPL</th>
                        <th className="text-right py-2 px-2">%MQL</th>
                        <th className="text-right py-2 px-2">Gasto</th>
                        <th className="text-right py-2 px-2">ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cityData.map((c, i) => {
                        const bestRoas = Math.max(...cityData.map(x => x.roas));
                        return (
                          <tr key={c.city} className="border-b border-border/50 hover:bg-accent/50">
                            <td className="py-2 px-2 text-foreground font-medium">
                              {c.roas === bestRoas && c.roas > 0 ? '🏆 ' : ''}{c.city}
                            </td>
                            <td className="text-right py-2 px-2 text-foreground">{fmt(c.leads)}</td>
                            <td className="text-right py-2 px-2 text-foreground">{fmtCurrency(c.cpl)}</td>
                            <td className="text-right py-2 px-2 text-foreground">{pct(c.mqlRate)}</td>
                            <td className="text-right py-2 px-2 text-foreground">{fmtCurrency(c.spend)}</td>
                            <td className="text-right py-2 px-2 text-foreground">{fmt(c.roas)}×</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground text-meta-body">Sem dados de cidades disponíveis</p>
              )}
            </CardContent>
          </Card>

          {/* Region Distribution */}
          {(() => {
            const regionAgg: Record<string, number> = {};
            for (const d of demos.filter(d => d.region)) {
              regionAgg[d.region] = (regionAgg[d.region] || 0) + Number(d.leads || 0);
            }
            const regionData = Object.entries(regionAgg)
              .map(([name, value]) => ({ name, value }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 8);

            if (regionData.length === 0) return null;

            return (
              <Card className="border-border rounded-meta-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-meta-heading-sm">Distribuição por Estado/Região</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={regionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {regionData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* ─── Tab 3: Devices ─── */}
        <TabsContent value="devices" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Device Donut */}
            <Card className="border-border rounded-meta-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-meta-heading-sm">Dispositivos</CardTitle>
              </CardHeader>
              <CardContent>
                {deviceData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4}>
                          {deviceData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    {totalDeviceLeads > 0 && (() => {
                      const mobileLeads = deviceData.find(d => d.name.toLowerCase().includes('mobile'))?.value || 0;
                      const mobilePct = Math.round((mobileLeads / totalDeviceLeads) * 100);
                      if (mobilePct > 50) {
                        return (
                          <div className="mt-3 p-2.5 bg-accent/50 rounded-meta-btn text-meta-caption text-foreground">
                            📱 {mobilePct}% dos leads vêm de mobile
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                ) : (
                  <p className="text-center py-8 text-muted-foreground text-meta-body">Sincronize dados para ver dispositivos</p>
                )}
              </CardContent>
            </Card>

            {/* Platform Bars */}
            <Card className="border-border rounded-meta-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-meta-heading-sm">Plataformas & Posicionamentos</CardTitle>
              </CardHeader>
              <CardContent>
                {platformData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={platformData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center py-8 text-muted-foreground text-meta-body">Sem dados de plataformas</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tab 4: Journey ─── */}
        <TabsContent value="journey" className="space-y-4">
          {personas.length === 0 ? (
            <Card className="border-border rounded-meta-card">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground text-meta-body">Gere personas primeiro para visualizar a jornada do cliente</p>
              </CardContent>
            </Card>
          ) : (
            personas.map((p) => {
              const funnelStages = [
                { name: 'Lead', value: p.total_leads, rate: 100 },
                { name: 'MQL', value: Math.round(p.total_leads * p.avg_mql_rate / 100), rate: p.avg_mql_rate },
                { name: 'SQL', value: Math.round(p.total_leads * p.avg_sql_rate / 100), rate: p.avg_sql_rate },
                { name: 'Fechamento', value: Math.round(p.total_leads * p.avg_close_rate / 100), rate: p.avg_close_rate },
              ];

              return (
                <Card key={p.id} className="border-border rounded-meta-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-meta-heading-sm flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {p.gender === 'male' ? '♂' : '♀'}
                      </div>
                      {p.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 flex-wrap">
                      {funnelStages.map((stage, i) => (
                        <div key={stage.name} className="flex items-center gap-2">
                          <div className="bg-accent rounded-meta-btn px-3 py-2 text-center min-w-[80px]">
                            <p className="text-meta-caption text-muted-foreground">{stage.name}</p>
                            <p className="text-meta-heading-sm text-foreground">{fmt(stage.value)}</p>
                            {i > 0 && <p className="text-[11px] text-primary">{pct(stage.rate)}</p>}
                          </div>
                          {i < funnelStages.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-4 text-meta-caption text-muted-foreground">
                      <span>💰 Deal médio: <strong className="text-foreground">{fmtCurrency(p.avg_deal_value)}</strong></span>
                      <span>📈 ROAS Real: <strong className="text-foreground">{fmt(p.roas_real)}×</strong></span>
                      {p.best_performing_placement && (
                        <span>📍 {p.best_performing_placement}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ─── Tab 5: Lookalike ─── */}
        <TabsContent value="lookalike" className="space-y-4">
          {personas.length === 0 ? (
            <Card className="border-border rounded-meta-card">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground text-meta-body">Gere personas primeiro para receber recomendações de Lookalike</p>
              </CardContent>
            </Card>
          ) : (
            personas.map((p, i) => (
              <Card key={p.id} className="border-border rounded-meta-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-meta-heading-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Público Lookalike Recomendado — {p.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-accent/50 rounded-meta-btn p-2.5">
                      <p className="text-meta-caption text-muted-foreground">Base</p>
                      <p className="text-meta-body text-foreground font-medium">Clientes fechados</p>
                    </div>
                    <div className="bg-accent/50 rounded-meta-btn p-2.5">
                      <p className="text-meta-caption text-muted-foreground">Tamanho</p>
                      <p className="text-meta-body text-foreground font-medium">1% (mais preciso)</p>
                    </div>
                    <div className="bg-accent/50 rounded-meta-btn p-2.5">
                      <p className="text-meta-caption text-muted-foreground">País</p>
                      <p className="text-meta-body text-foreground font-medium">Brasil</p>
                    </div>
                    <div className="bg-accent/50 rounded-meta-btn p-2.5">
                      <p className="text-meta-caption text-muted-foreground">ROAS Esperado</p>
                      <p className="text-meta-body text-foreground font-medium">{fmt(p.roas_real)}×</p>
                    </div>
                  </div>

                  <div className="p-3 bg-primary/5 rounded-meta-btn border border-primary/10">
                    <p className="text-meta-caption text-foreground">
                      <strong>Por quê:</strong> Perfil {p.gender === 'male' ? 'masculino' : 'feminino'} {p.age_range} com ROAS de {fmt(p.roas_real)}× 
                      {p.top_cities?.length > 0 && ` concentrado em ${p.top_cities.slice(0, 2).join(' e ')}`}.
                      CPL de {fmtCurrency(p.avg_cpl)} e {fmt(p.total_leads)} leads gerados nos últimos 90 dias.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-meta-btn text-meta-caption" onClick={() => toast.info('Para criar o público, acesse o Gerenciador de Anúncios do Meta')}>
                      <Target className="h-3 w-3 mr-1.5" /> Criar no Meta
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-meta-btn text-meta-caption" onClick={() => toast.success('Sugestão salva')}>
                      Salvar sugestão
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
