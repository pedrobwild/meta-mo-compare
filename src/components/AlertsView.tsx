import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Plus, Trash2, AlertTriangle, CheckCircle, Clock, Mail } from 'lucide-react';
import { getMetricLabel, METRICS } from '@/lib/metrics';
import { toast } from 'sonner';

export default function AlertsView() {
  const { workspace } = useWorkspace();
  const [rules, setRules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '', metric: 'cpa_lead', operator: 'gt', threshold: 0, severity: 'medium', notify_email: true,
  });

  useEffect(() => {
    if (!workspace) return;
    Promise.all([
      supabase.from('alert_rules').select('*').eq('workspace_id', workspace.id),
      supabase.from('alert_events').select('*').eq('workspace_id', workspace.id).order('triggered_at', { ascending: false }).limit(50),
    ]).then(([rulesRes, eventsRes]) => {
      setRules(rulesRes.data || []);
      setEvents(eventsRes.data || []);
    });
  }, [workspace]);

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
      notification_channels_json: channels,
    }).select().single();
    if (data) {
      setRules(prev => [...prev, data]);
      setShowAdd(false);
      setNewRule({ name: '', metric: 'cpa_lead', operator: 'gt', threshold: 0, severity: 'medium', notify_email: true });
    }
  };

  const toggleEmailForRule = async (ruleId: string, currentChannels: any) => {
    const channels = Array.isArray(currentChannels) ? currentChannels : [];
    const hasEmail = channels.includes('email');
    const newChannels = hasEmail ? channels.filter((c: string) => c !== 'email') : [...channels, 'email'];
    const { error } = await supabase.from('alert_rules').update({
      notification_channels_json: newChannels,
    }).eq('id', ruleId);
    if (!error) {
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, notification_channels_json: newChannels } : r));
      toast.success(hasEmail ? 'Notificação por e-mail desativada' : 'Notificação por e-mail ativada');
    }
  };

  const deleteRule = async (id: string) => {
    await supabase.from('alert_rules').delete().eq('id', id);
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const resolveEvent = async (id: string) => {
    await supabase.from('alert_events').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'resolved' } : e));
  };

  const sendTestEmail = async (rule: any) => {
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
      if (!data?.success) throw new Error(data?.error || 'Erro');
      toast.success(`E-mail de teste enviado para ${data.recipients?.join(', ')}`);
    } catch (err: any) {
      toast.error(`Erro ao enviar e-mail: ${err.message}`);
    }
  };

  const getSeverityColor = (s: string) => {
    if (s === 'high') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (s === 'medium') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const metricOptions = Object.keys(METRICS);

  const hasEmail = (rule: any) => {
    const channels = Array.isArray(rule.notification_channels_json) ? rule.notification_channels_json : [];
    return channels.includes('email');
  };

  return (
    <div className="space-y-6">
      {/* Alert Rules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" /> Regras de Alerta
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4 mr-1" /> Nova Regra
          </Button>
        </div>

        {showAdd && (
          <Card className="glass-card border-primary/20 mb-4">
            <CardContent className="p-4 space-y-3">
              <Input placeholder="Nome da regra" value={newRule.name} onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))} className="bg-background/50" />
              <div className="grid grid-cols-4 gap-2">
                <Select value={newRule.metric} onValueChange={v => setNewRule(p => ({ ...p, metric: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {metricOptions.map(k => <SelectItem key={k} value={k}>{getMetricLabel(k)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={newRule.operator} onValueChange={v => setNewRule(p => ({ ...p, operator: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gt">Maior que</SelectItem>
                    <SelectItem value="lt">Menor que</SelectItem>
                    <SelectItem value="change_gt">Variação &gt;</SelectItem>
                    <SelectItem value="change_lt">Variação &lt;</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Threshold" value={newRule.threshold} onChange={e => setNewRule(p => ({ ...p, threshold: Number(e.target.value) }))} className="bg-background/50" />
                <Select value={newRule.severity} onValueChange={v => setNewRule(p => ({ ...p, severity: v }))}>
                  <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alto</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="low">Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="notify-email"
                  checked={newRule.notify_email}
                  onCheckedChange={(v) => setNewRule(p => ({ ...p, notify_email: v }))}
                />
                <Label htmlFor="notify-email" className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <Mail className="h-3.5 w-3.5" /> Notificar por e-mail
                </Label>
              </div>
              <Button size="sm" onClick={addRule}>Salvar Regra</Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {rules.map(rule => (
            <Card key={rule.id} className="glass-card border-border/30">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={getSeverityColor(rule.severity)}>{rule.severity}</Badge>
                  <span className="text-sm font-medium">{rule.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {getMetricLabel(rule.metric)} {rule.operator} {rule.threshold}
                  </span>
                  {hasEmail(rule) && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Mail className="h-2.5 w-2.5" /> E-mail
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={hasEmail(rule)}
                    onCheckedChange={() => toggleEmailForRule(rule.id, rule.notification_channels_json)}
                    className="scale-75"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => sendTestEmail(rule)} title="Enviar e-mail de teste">
                    <Mail className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteRule(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma regra configurada.</p>
          )}
        </div>
      </div>

      {/* Alert Events */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-400" /> Eventos de Alerta
        </h2>
        <div className="space-y-2">
          {events.map(event => {
            const matchedRule = rules.find(r => r.id === event.rule_id);
            return (
              <Card key={event.id} className={`glass-card border-border/30 ${event.status === 'open' ? 'border-l-2 border-l-amber-500' : 'opacity-60'}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {event.status === 'open' ? <Clock className="h-4 w-4 text-amber-400" /> : <CheckCircle className="h-4 w-4 text-emerald-400" />}
                    <div>
                      <span className="text-sm">
                        {matchedRule?.name ? `${matchedRule.name}: ` : ''}
                        {getMetricLabel(event.context_json?.metric || '')} = {Number(event.context_json?.current_value || 0).toFixed(2)}
                      </span>
                      {event.context_json?.entity && (
                        <span className="text-xs text-muted-foreground ml-2">({event.context_json.entity})</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-2">
                        {new Date(event.triggered_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  {event.status === 'open' && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => resolveEvent(event.id)}>
                      Resolver
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento disparado.</p>
          )}
        </div>
      </div>
    </div>
  );
}
