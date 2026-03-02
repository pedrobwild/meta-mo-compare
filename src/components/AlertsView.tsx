import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/integrations/supabase/client';
import {
  Bell, Plus, Trash2, AlertTriangle, CheckCircle, Clock, Mail, Sparkles,
  Loader2, Eye, AlarmClock, TrendingUp, TrendingDown, Activity, Settings,
  History, Search, X
} from 'lucide-react';
import { getMetricLabel, METRICS } from '@/lib/metrics';
import { toast } from 'sonner';

// ── Types ──
type AlertRule = {
  id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  scope: string;
  enabled: boolean;
  notification_channels_json: any;
  window_days: number;
  min_spend: number | null;
  workspace_id: string;
  created_at: string;
};

type AlertEvent = {
  id: string;
  rule_id: string | null;
  triggered_at: string;
  context_json: any;
  status: string;
  resolved_at: string | null;
  workspace_id: string;
};

type AnomalyEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  metric: string;
  value_current: number;
  value_expected: number;
  deviation_pct: number;
  severity: string;
  status: string;
  detected_at: string;
  workspace_id: string;
};

// ── Helpers ──
const severityConfig: Record<string, { icon: string; color: string; label: string }> = {
  critical: { icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Crítico' },
  high: { icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Alto' },
  medium: { icon: '🟡', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Médio' },
  low: { icon: '🟢', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Baixo' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `há ${Math.floor(diff / 60000)}min`;
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

const operatorLabels: Record<string, string> = {
  gt: 'Maior que',
  lt: 'Menor que',
  gte: '≥',
  lte: '≤',
  change_gt: 'Variação >',
  change_lt: 'Variação <',
  change_pct: 'Variação % >',
};

// ── Suggested default rules ──
const DEFAULT_RULES = [
  { name: 'ROAS abaixo do mínimo', metric: 'roas', operator: 'lt', threshold: 2.0, severity: 'high' },
  { name: 'CPA acima do limite', metric: 'cpa_lead', operator: 'gt', threshold: 50, severity: 'high' },
  { name: 'CTR muito baixo', metric: 'ctr_link', operator: 'lt', threshold: 0.5, severity: 'medium' },
  { name: 'Frequência alta — fadiga', metric: 'frequency', operator: 'gt', threshold: 4.0, severity: 'medium' },
  { name: 'Investimento zerado', metric: 'spend', operator: 'lte', threshold: 0, severity: 'high' },
];

const metricOptions = Object.keys(METRICS);

export default function AlertsView() {
  const { workspace } = useWorkspace();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Add rule form
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '', metric: 'cpa_lead', operator: 'gt', threshold: 0,
    severity: 'medium', scope: 'account', notify_email: true,
  });

  // Resolve modal
  const [resolveModal, setResolveModal] = useState<{ id: string; type: 'alert' | 'anomaly' } | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  // Claude analysis
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [claudeAnalysis, setClaudeAnalysis] = useState<Record<string, string>>({});

  // Filters for history
  const [histFilter, setHistFilter] = useState({ search: '', severity: 'all' });

  // ── Data fetching ──
  useEffect(() => {
    if (!workspace) return;
    setLoading(true);
    Promise.all([
      supabase.from('alert_rules').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
      supabase.from('alert_events').select('*').eq('workspace_id', workspace.id).order('triggered_at', { ascending: false }).limit(200),
      supabase.from('anomaly_events' as any).select('*').eq('workspace_id', workspace.id).order('detected_at', { ascending: false }).limit(100),
    ]).then(([rulesRes, eventsRes, anomalyRes]) => {
      setRules((rulesRes.data || []) as AlertRule[]);
      setEvents((eventsRes.data || []) as AlertEvent[]);
      setAnomalies((anomalyRes.data || []) as unknown as AnomalyEvent[]);
      setLoading(false);
    });
  }, [workspace]);

  // ── Rule CRUD ──
  const addRule = async () => {
    if (!workspace || !newRule.name) return;
    const channels = newRule.notify_email ? ['email'] : [];
    const { data, error } = await supabase.from('alert_rules').insert({
      workspace_id: workspace.id,
      name: newRule.name,
      metric: newRule.metric,
      operator: newRule.operator,
      threshold: newRule.threshold,
      severity: newRule.severity,
      scope: newRule.scope,
      notification_channels_json: channels,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      setRules(prev => [data as AlertRule, ...prev]);
      setShowAdd(false);
      setNewRule({ name: '', metric: 'cpa_lead', operator: 'gt', threshold: 0, severity: 'medium', scope: 'account', notify_email: true });
      toast.success('Regra criada!');
    }
  };

  const toggleRule = async (id: string, enabled: boolean) => {
    await supabase.from('alert_rules').update({ enabled }).eq('id', id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
  };

  const toggleEmail = async (rule: AlertRule) => {
    const channels = Array.isArray(rule.notification_channels_json) ? rule.notification_channels_json : [];
    const hasEmail = channels.includes('email');
    const newChannels = hasEmail ? channels.filter((c: string) => c !== 'email') : [...channels, 'email'];
    await supabase.from('alert_rules').update({ notification_channels_json: newChannels }).eq('id', rule.id);
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, notification_channels_json: newChannels } : r));
    toast.success(hasEmail ? 'E-mail desativado' : 'E-mail ativado');
  };

  const deleteRule = async (id: string) => {
    await supabase.from('alert_rules').delete().eq('id', id);
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success('Regra removida');
  };

  const addSuggestedRules = async () => {
    if (!workspace) return;
    for (const rule of DEFAULT_RULES) {
      const exists = rules.some(r => r.name === rule.name);
      if (exists) continue;
      const { data } = await supabase.from('alert_rules').insert({
        workspace_id: workspace.id,
        ...rule,
        notification_channels_json: ['email'],
      }).select().single();
      if (data) setRules(prev => [data as AlertRule, ...prev]);
    }
    toast.success('Regras sugeridas adicionadas!');
  };

  // ── Event actions ──
  const resolveEvent = async () => {
    if (!resolveModal) return;
    if (resolveModal.type === 'alert') {
      await supabase.from('alert_events').update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        context_json: events.find(e => e.id === resolveModal.id)?.context_json
          ? { ...events.find(e => e.id === resolveModal.id)!.context_json, resolution_note: resolveNote }
          : { resolution_note: resolveNote },
      }).eq('id', resolveModal.id);
      setEvents(prev => prev.map(e => e.id === resolveModal.id ? { ...e, status: 'resolved', resolved_at: new Date().toISOString() } : e));
    } else {
      await supabase.from('anomaly_events' as any).update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      } as any).eq('id', resolveModal.id);
      setAnomalies(prev => prev.map(a => a.id === resolveModal.id ? { ...a, status: 'resolved' } : a));
    }
    setResolveModal(null);
    setResolveNote('');
    toast.success('Resolvido!');
  };

  const snoozeEvent = async (id: string) => {
    await supabase.from('alert_events').update({ status: 'snoozed' }).eq('id', id);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'snoozed' } : e));
    toast.success('Alerta adiado por 24h');
  };

  const sendTestEmail = async (rule: AlertRule) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-alert-email', {
        body: {
          rule_name: rule.name,
          metric_label: getMetricLabel(rule.metric),
          current_value: rule.threshold * 1.15,
          threshold: rule.threshold,
          operator: rule.operator,
          severity: rule.severity,
          entity_name: 'Campanha de Teste',
          app_url: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
      toast.success(`E-mail de teste enviado!`);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  // ── Claude analysis ──
  const askClaudeAnalysis = async (event: AlertEvent) => {
    setAnalyzingId(event.id);
    try {
      const rule = rules.find(r => r.id === event.rule_id);
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `Um alerta foi disparado no Meta Ads Manager.

Regra: ${rule?.name || 'Desconhecida'}
Métrica: ${event.context_json?.metric || ''}
Valor atual: ${event.context_json?.current_value}
Threshold: ${event.context_json?.threshold}
Entidade: ${event.context_json?.entity || 'Conta toda'}
Severidade: ${event.context_json?.severity || rule?.severity}

Analise este alerta e responda em português:
1. Qual a causa mais provável?
2. Qual a urgência real (pode ser falso positivo)?
3. Qual ação tomar agora?
4. O que monitorar nos próximos dias?

Seja direto e baseado em dados.`,
          }],
        },
      });
      if (error) throw error;
      const text = typeof data === 'string' ? data : data?.choices?.[0]?.message?.content || data?.content || JSON.stringify(data);
      setClaudeAnalysis(prev => ({ ...prev, [event.id]: text }));
    } catch (err: any) {
      toast.error(err.message || 'Erro ao analisar');
    } finally {
      setAnalyzingId(null);
    }
  };

  // ── Filtered data ──
  const openEvents = events.filter(e => e.status === 'open');
  const snoozedEvents = events.filter(e => e.status === 'snoozed');
  const openAnomalies = anomalies.filter(a => a.status === 'open');
  const resolvedEvents = events.filter(e => e.status === 'resolved');
  const resolvedAnomalies = anomalies.filter(a => a.status === 'resolved');

  const filteredHistory = [...resolvedEvents.map(e => ({ ...e, _type: 'alert' as const })), ...resolvedAnomalies.map(a => ({ ...a, _type: 'anomaly' as const, triggered_at: a.detected_at }))].sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()).filter(item => {
    if (histFilter.search) {
      const ctx = (item as any).context_json;
      const name = (item as any).entity_name || ctx?.entity || ctx?.metric || '';
      if (!name.toLowerCase().includes(histFilter.search.toLowerCase())) return false;
    }
    if (histFilter.severity !== 'all') {
      const sev = (item as any).context_json?.severity || (item as any).severity || '';
      if (sev !== histFilter.severity) return false;
    }
    return true;
  });

  const hasEmail = (rule: AlertRule) => {
    const channels = Array.isArray(rule.notification_channels_json) ? rule.notification_channels_json : [];
    return channels.includes('email');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Centro de Alertas
        </h2>
        <div className="flex gap-2">
          {openEvents.length > 0 && (
            <Badge variant="destructive" className="text-xs">{openEvents.length} abertos</Badge>
          )}
          {openAnomalies.length > 0 && (
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">{openAnomalies.length} anomalias</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="events" className="text-xs gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Ativos ({openEvents.length})
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="text-xs gap-1">
            <Activity className="h-3.5 w-3.5" /> Anomalias ({openAnomalies.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs gap-1">
            <History className="h-3.5 w-3.5" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs gap-1">
            <Settings className="h-3.5 w-3.5" /> Regras ({rules.length})
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: EVENTOS ATIVOS ═══ */}
        <TabsContent value="events" className="space-y-3">
          {openEvents.length === 0 && snoozedEvents.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-400/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum alerta ativo. Tudo sob controle! 🎯</p>
            </div>
          ) : (
            <>
              {openEvents.map(event => {
                const rule = rules.find(r => r.id === event.rule_id);
                const sev = severityConfig[event.context_json?.severity || rule?.severity || 'medium'] || severityConfig.medium;
                return (
                  <Card key={event.id} className="glass-card border-l-2 border-l-amber-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{sev.icon}</span>
                            <span className="text-sm font-semibold text-foreground">{rule?.name || 'Regra removida'}</span>
                            <Badge variant="outline" className={`text-[10px] ${sev.color}`}>{sev.label}</Badge>
                            <span className="text-xs text-muted-foreground">{timeAgo(event.triggered_at)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{getMetricLabel(event.context_json?.metric || '')} = <strong className="text-foreground">{Number(event.context_json?.current_value || 0).toFixed(2)}</strong></span>
                            <span>Threshold: {Number(event.context_json?.threshold || 0).toFixed(2)}</span>
                            {event.context_json?.entity && <span>📊 {event.context_json.entity}</span>}
                          </div>

                          {/* Claude analysis */}
                          {claudeAnalysis[event.id] && (
                            <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                              <p className="text-[10px] uppercase font-semibold text-primary mb-1 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Análise IA
                              </p>
                              {claudeAnalysis[event.id]}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setResolveModal({ id: event.id, type: 'alert' })}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Resolver
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => snoozeEvent(event.id)}>
                            <AlarmClock className="h-3 w-3 mr-1" /> Soneca 24h
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7"
                            disabled={analyzingId === event.id}
                            onClick={() => askClaudeAnalysis(event)}
                          >
                            {analyzingId === event.id
                              ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              : <Sparkles className="h-3 w-3 mr-1" />}
                            Analisar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {snoozedEvents.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Adiados ({snoozedEvents.length})</p>
                  {snoozedEvents.map(event => {
                    const rule = rules.find(r => r.id === event.rule_id);
                    return (
                      <Card key={event.id} className="glass-card opacity-60 mb-2">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            <AlarmClock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{rule?.name}</span>
                            <span className="text-muted-foreground">{getMetricLabel(event.context_json?.metric || '')}</span>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setResolveModal({ id: event.id, type: 'alert' })}>
                            Resolver
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ═══ TAB 2: ANOMALIAS ═══ */}
        <TabsContent value="anomalies" className="space-y-3">
          {openAnomalies.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Activity className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma anomalia detectada.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">O sistema verifica desvios estatísticos diariamente.</p>
            </div>
          ) : (
            openAnomalies.sort((a, b) => {
              const order = { critical: 0, high: 1, medium: 2, low: 3 };
              return (order[a.severity as keyof typeof order] ?? 4) - (order[b.severity as keyof typeof order] ?? 4);
            }).map(anomaly => {
              const sev = severityConfig[anomaly.severity] || severityConfig.medium;
              const isUp = anomaly.deviation_pct > 0;
              return (
                <Card key={anomaly.id} className={`glass-card border-l-2 ${anomaly.severity === 'critical' ? 'border-l-red-500' : 'border-l-amber-500'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base">{sev.icon}</span>
                          <span className="text-sm font-semibold text-foreground">{anomaly.entity_name || anomaly.entity_id}</span>
                          <Badge variant="outline" className={`text-[10px] ${sev.color}`}>{sev.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground">{getMetricLabel(anomaly.metric)}</span>
                          <span className="font-medium text-foreground">{Number(anomaly.value_current).toFixed(2)}</span>
                          <span className="text-muted-foreground">vs esperado {Number(anomaly.value_expected).toFixed(2)}</span>
                          <span className={`font-semibold flex items-center gap-0.5 ${isUp ? 'text-red-400' : 'text-emerald-400'}`}>
                            {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {anomaly.deviation_pct > 0 ? '+' : ''}{anomaly.deviation_pct.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{timeAgo(anomaly.detected_at)}</p>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setResolveModal({ id: anomaly.id, type: 'anomaly' })}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Resolver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ═══ TAB 3: HISTÓRICO ═══ */}
        <TabsContent value="history" className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filtrar por nome..."
                value={histFilter.search}
                onChange={e => setHistFilter(p => ({ ...p, search: e.target.value }))}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <Select value={histFilter.severity} onValueChange={v => setHistFilter(p => ({ ...p, severity: v }))}>
              <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="low">Baixo</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <History className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum alerta resolvido encontrado.</p>
            </div>
          ) : (
            filteredHistory.slice(0, 50).map(item => {
              const isAlert = item._type === 'alert';
              const sev = severityConfig[(item as any).context_json?.severity || (item as any).severity || 'medium'] || severityConfig.medium;
              const resolvedAt = (item as any).resolved_at;
              const triggeredAt = (item as any).triggered_at || (item as any).detected_at;
              const resolutionTime = resolvedAt && triggeredAt
                ? Math.round((new Date(resolvedAt).getTime() - new Date(triggeredAt).getTime()) / 3600000)
                : null;

              return (
                <Card key={item.id} className="glass-card opacity-70">
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      <Badge variant="outline" className={`text-[10px] ${sev.color}`}>{sev.icon}</Badge>
                      <span className="font-medium">
                        {isAlert
                          ? (rules.find(r => r.id === (item as AlertEvent).rule_id)?.name || 'Regra')
                          : ((item as AnomalyEvent).entity_name || 'Anomalia')}
                      </span>
                      <span className="text-muted-foreground">
                        {isAlert ? getMetricLabel((item as AlertEvent).context_json?.metric || '') : getMetricLabel((item as AnomalyEvent).metric)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {resolutionTime !== null && <span>⏱️ {resolutionTime}h</span>}
                      <span>{new Date(triggeredAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ═══ TAB 4: CONFIGURAR REGRAS ═══ */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
                <Plus className="h-4 w-4 mr-1" /> Nova Regra
              </Button>
              {rules.length === 0 && (
                <Button size="sm" variant="default" onClick={addSuggestedRules}>
                  <Sparkles className="h-4 w-4 mr-1" /> Adicionar regras sugeridas
                </Button>
              )}
            </div>
          </div>

          {showAdd && (
            <Card className="glass-card border-primary/20">
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Nome da regra"
                  value={newRule.name}
                  onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))}
                  className="bg-background/50"
                />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Select value={newRule.scope} onValueChange={v => setNewRule(p => ({ ...p, scope: v }))}>
                    <SelectTrigger className="bg-background/50 text-xs"><SelectValue placeholder="Escopo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="account">Conta toda</SelectItem>
                      <SelectItem value="campaign">Todas campanhas</SelectItem>
                      <SelectItem value="adset">Todos conjuntos</SelectItem>
                      <SelectItem value="ad">Todos anúncios</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={newRule.metric} onValueChange={v => setNewRule(p => ({ ...p, metric: v }))}>
                    <SelectTrigger className="bg-background/50 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {metricOptions.map(k => <SelectItem key={k} value={k}>{getMetricLabel(k)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={newRule.operator} onValueChange={v => setNewRule(p => ({ ...p, operator: v }))}>
                    <SelectTrigger className="bg-background/50 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gt">Maior que</SelectItem>
                      <SelectItem value="lt">Menor que</SelectItem>
                      <SelectItem value="gte">≥</SelectItem>
                      <SelectItem value="lte">≤</SelectItem>
                      <SelectItem value="change_gt">Variou mais que %</SelectItem>
                      <SelectItem value="change_lt">Variou menos que %</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Threshold"
                    value={newRule.threshold}
                    onChange={e => setNewRule(p => ({ ...p, threshold: Number(e.target.value) }))}
                    className="bg-background/50 text-xs"
                  />
                  <Select value={newRule.severity} onValueChange={v => setNewRule(p => ({ ...p, severity: v }))}>
                    <SelectTrigger className="bg-background/50 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">🔴 Alto</SelectItem>
                      <SelectItem value="medium">🟡 Médio</SelectItem>
                      <SelectItem value="low">🟢 Baixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="new-notify"
                      checked={newRule.notify_email}
                      onCheckedChange={v => setNewRule(p => ({ ...p, notify_email: v }))}
                    />
                    <Label htmlFor="new-notify" className="text-xs cursor-pointer flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> Notificar por e-mail
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
                    <Button size="sm" onClick={addRule}>Salvar</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {rules.map(rule => (
              <Card key={rule.id} className={`glass-card border-border/30 ${!rule.enabled ? 'opacity-50' : ''}`}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={v => toggleRule(rule.id, v)}
                      className="scale-75 flex-shrink-0"
                    />
                    <Badge variant="outline" className={`text-[10px] ${severityConfig[rule.severity]?.color || ''}`}>
                      {severityConfig[rule.severity]?.icon} {severityConfig[rule.severity]?.label}
                    </Badge>
                    <span className="text-sm font-medium truncate">{rule.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {getMetricLabel(rule.metric)} {operatorLabels[rule.operator] || rule.operator} {rule.threshold}
                    </span>
                    {hasEmail(rule) && (
                      <Badge variant="outline" className="text-[10px] gap-0.5">
                        <Mail className="h-2.5 w-2.5" /> E-mail
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleEmail(rule)} title="Toggle e-mail">
                      <Mail className={`h-3.5 w-3.5 ${hasEmail(rule) ? 'text-primary' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => sendTestEmail(rule)} title="Enviar teste">
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {rules.length === 0 && (
              <div className="glass-card p-8 text-center">
                <Settings className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma regra configurada.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={addSuggestedRules}>
                  <Sparkles className="h-4 w-4 mr-1" /> Adicionar regras sugeridas
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ RESOLVE MODAL ═══ */}
      <Dialog open={!!resolveModal} onOpenChange={() => setResolveModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resolver alerta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Nota de resolução (opcional)</Label>
            <Textarea
              value={resolveNote}
              onChange={e => setResolveNote(e.target.value)}
              placeholder="Ex: CPA normalizou após otimização de público..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolveModal(null)}>Cancelar</Button>
            <Button onClick={resolveEvent}>
              <CheckCircle className="h-4 w-4 mr-1" /> Resolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
