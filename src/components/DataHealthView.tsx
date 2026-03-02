import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  RefreshCw, Loader2, CheckCircle, AlertTriangle, XCircle,
  Wifi, Link2, Zap, Eye, Users, BarChart3, Calendar,
  ArrowRight, ExternalLink, Check
} from 'lucide-react';

// ── Types ──

interface HealthCheck {
  id: string;
  checked_at: string;
  check_type: string;
  status: string;
  entity: string;
  issue_description: string;
  recommendation: string;
  auto_resolved: boolean;
  resolved_at: string | null;
}

interface DataGap {
  id: string;
  detected_at: string;
  gap_type: string;
  campaign_id: string | null;
  campaign_name: string | null;
  date_from: string | null;
  date_to: string | null;
  affected_records: number;
  severity: string;
  status: string;
  notes: string | null;
}

// ── Constants ──

const CHECK_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  sync: { label: 'Sync', icon: <Wifi className="h-4 w-4" /> },
  utm: { label: 'UTMs', icon: <Link2 className="h-4 w-4" /> },
  pixel: { label: 'Pixel/CAPI', icon: <Zap className="h-4 w-4" /> },
  attribution: { label: 'Atribuição', icon: <Eye className="h-4 w-4" /> },
  leads: { label: 'Qualidade Leads', icon: <Users className="h-4 w-4" /> },
};

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  healthy: { color: 'text-emerald-400', icon: <CheckCircle className="h-4 w-4 text-emerald-400" /> },
  warning: { color: 'text-amber-400', icon: <AlertTriangle className="h-4 w-4 text-amber-400" /> },
  critical: { color: 'text-red-400', icon: <XCircle className="h-4 w-4 text-red-400" /> },
  low: { color: 'text-blue-400', icon: <CheckCircle className="h-4 w-4 text-blue-400" /> },
  medium: { color: 'text-amber-400', icon: <AlertTriangle className="h-4 w-4 text-amber-400" /> },
  high: { color: 'text-orange-400', icon: <AlertTriangle className="h-4 w-4 text-orange-400" /> },
};

const GAP_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  missing_utm: { label: 'Leads sem UTM', emoji: '🟡' },
  missing_data: { label: 'Dados ausentes', emoji: '🔴' },
  sync_failure: { label: 'Falha de sync', emoji: '🔴' },
  zero_spend: { label: 'Spend zerado', emoji: '🟠' },
  zero_leads: { label: 'Spend sem conversões', emoji: '🔴' },
  duplicate_data: { label: 'Dados duplicados', emoji: '🟠' },
};

const META_2026_CHECKS = [
  { id: 'attribution', label: 'Janelas de atribuição atualizadas (7-day click / 1-day view)', checkType: 'attribution' },
  { id: 'thruplay', label: 'Métricas de vídeo: ThruPlay em uso', checkType: 'attribution' },
  { id: 'advantage_plus', label: 'Advantage+ Shopping migrado para nova API', checkType: 'attribution' },
  { id: 'targeting', label: 'Interesses de Detailed Targeting atualizados', checkType: 'attribution' },
  { id: 'historical', label: 'Dados históricos respeitando limite de 13 meses', checkType: 'sync' },
  { id: 'video_feeds', label: 'Facebook Video Feeds substituído por Facebook Reels', checkType: 'attribution' },
  { id: 'emq', label: 'Event Match Quality CAPI ≥ 6.0', checkType: 'pixel' },
];

// ── Component ──

export default function DataHealthView() {
  const { workspace } = useWorkspace();
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [gaps, setGaps] = useState<DataGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadData = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const [checksRes, gapsRes] = await Promise.all([
      supabase.from('data_health_checks').select('*')
        .eq('workspace_id', workspace.id)
        .order('checked_at', { ascending: false }).limit(200),
      supabase.from('data_gaps').select('*')
        .eq('workspace_id', workspace.id)
        .order('detected_at', { ascending: false }).limit(200),
    ]);
    if (checksRes.data) setChecks(checksRes.data as any);
    if (gapsRes.data) setGaps(gapsRes.data as any);
    setLoading(false);
  }, [workspace]);

  useEffect(() => { loadData(); }, [loadData]);

  const runChecks = async () => {
    if (!workspace) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-health-checks', {
        body: { workspace_id: workspace.id },
      });
      if (error) throw error;
      toast.success(`Verificação concluída: ${data.issues_found} issues, ${data.gaps_found} lacunas`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao executar verificação');
    } finally {
      setRunning(false);
    }
  };

  const resolveCheck = async (id: string) => {
    await supabase.from('data_health_checks').update({ resolved_at: new Date().toISOString() }).eq('id', id);
    toast.success('Issue marcada como resolvida');
    loadData();
  };

  const resolveGap = async (id: string) => {
    await supabase.from('data_gaps').update({ status: 'resolved' }).eq('id', id);
    toast.success('Lacuna resolvida');
    loadData();
  };

  // ── Computed Scores ──
  const activeChecks = useMemo(() => checks.filter(c => !c.resolved_at), [checks]);

  const scores = useMemo(() => {
    const byType: Record<string, { total: number; critical: number; warning: number }> = {};
    const types = ['sync', 'utm', 'pixel', 'attribution', 'leads'];
    types.forEach(t => { byType[t] = { total: 0, critical: 0, warning: 0 }; });

    activeChecks.forEach(c => {
      const t = c.check_type;
      if (byType[t]) {
        byType[t].total++;
        if (c.status === 'critical') byType[t].critical++;
        if (c.status === 'warning') byType[t].warning++;
      }
    });

    const typeScores: Record<string, number> = {};
    types.forEach(t => {
      const d = byType[t];
      if (d.total === 0) { typeScores[t] = 100; return; }
      typeScores[t] = Math.max(0, 100 - (d.critical * 30) - (d.warning * 15));
    });

    const overall = Math.round(Object.values(typeScores).reduce((a, b) => a + b, 0) / types.length);
    return { overall, byType: typeScores };
  }, [activeChecks]);

  const scoreColor = scores.overall >= 80 ? 'text-emerald-400' : scores.overall >= 60 ? 'text-amber-400' : 'text-red-400';
  const scoreBg = scores.overall >= 80 ? 'from-emerald-500/20 to-emerald-500/5' : scores.overall >= 60 ? 'from-amber-500/20 to-amber-500/5' : 'from-red-500/20 to-red-500/5';
  const scoreLabel = scores.overall >= 80 ? 'Saudável' : scores.overall >= 60 ? 'Atenção' : 'Crítico';
  const ScoreIcon = scores.overall >= 80 ? ShieldCheck : scores.overall >= 60 ? ShieldAlert : ShieldX;

  const openGaps = useMemo(() => gaps.filter(g => g.status === 'open'), [gaps]);

  // Meta 2026 compliance
  const compliance2026 = useMemo(() => {
    return META_2026_CHECKS.map(check => {
      const relatedIssues = activeChecks.filter(c =>
        c.check_type === check.checkType &&
        c.status === 'critical' &&
        c.issue_description.toLowerCase().includes(
          check.id === 'attribution' ? 'atribuição' :
          check.id === 'thruplay' ? 'video' :
          check.id === 'emq' ? 'match quality' :
          check.id
        )
      );
      return { ...check, passed: relatedIssues.length === 0 };
    });
  }, [activeChecks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Saúde dos Dados
        </h2>
        <Button size="sm" onClick={runChecks} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Executar verificação
        </Button>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        {/* Main score */}
        <Card className={`glass-card md:col-span-2 bg-gradient-to-br ${scoreBg}`}>
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <ScoreIcon className={`h-10 w-10 ${scoreColor} mb-2`} />
            <p className={`text-5xl font-bold ${scoreColor}`}>{scores.overall}</p>
            <p className="text-xs text-muted-foreground mt-1">{scoreLabel}</p>
          </CardContent>
        </Card>

        {/* Sub-scores */}
        <div className="md:col-span-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(CHECK_TYPE_CONFIG).map(([key, cfg]) => {
            const s = scores.byType[key] ?? 100;
            const c = s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-amber-400' : 'text-red-400';
            return (
              <Card key={key} className="glass-card">
                <CardContent className="p-3 text-center">
                  <div className={`mx-auto mb-1 ${c}`}>{cfg.icon}</div>
                  <p className={`text-xl font-bold ${c}`}>{s}</p>
                  <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Tabs defaultValue="issues" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="issues" className="text-xs gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Issues {activeChecks.length > 0 && <Badge variant="destructive" className="text-[10px] ml-1 h-4 px-1">{activeChecks.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="gaps" className="text-xs gap-1">
            <BarChart3 className="h-3.5 w-3.5" />
            Lacunas {openGaps.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1">{openGaps.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Meta 2026
          </TabsTrigger>
        </TabsList>

        {/* ═══ ISSUES TAB ═══ */}
        <TabsContent value="issues" className="space-y-2">
          {activeChecks.length === 0 && (
            <Card className="glass-card">
              <CardContent className="py-10 text-center text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mx-auto mb-3 text-emerald-400/40" />
                <p className="text-sm">Nenhuma issue ativa. Seus dados estão saudáveis!</p>
                <p className="text-xs mt-1">Execute uma verificação para atualizar.</p>
              </CardContent>
            </Card>
          )}

          {activeChecks.map(check => {
            const sev = SEVERITY_CONFIG[check.status] || SEVERITY_CONFIG.warning;
            const typeCfg = CHECK_TYPE_CONFIG[check.check_type] || CHECK_TYPE_CONFIG.sync;
            return (
              <motion.div key={check.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={`glass-card group ${check.status === 'critical' ? 'border-red-500/30' : check.status === 'warning' ? 'border-amber-500/20' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {sev.icon}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{typeCfg.label}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${check.status === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}>
                            {check.status === 'critical' ? '🔴 Crítico' : '🟡 Atenção'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{check.entity}</span>
                        </div>
                        <p className="text-sm text-foreground">{check.issue_description}</p>
                        <div className="flex items-start gap-1.5 mt-1">
                          <ArrowRight className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">{check.recommendation}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-[10px] h-7 flex-shrink-0" onClick={() => resolveCheck(check.id)}>
                        <Check className="h-3 w-3 mr-1" /> Resolvido
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}

          {/* Resolved checks (collapsed) */}
          {checks.filter(c => c.resolved_at).length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                {checks.filter(c => c.resolved_at).length} issues resolvidas
              </summary>
              <div className="mt-2 space-y-1">
                {checks.filter(c => c.resolved_at).slice(0, 10).map(check => (
                  <div key={check.id} className="flex items-center gap-2 text-xs text-muted-foreground/70 py-1 px-2 rounded bg-secondary/10">
                    <CheckCircle className="h-3 w-3 text-emerald-400/50" />
                    <span className="flex-1 truncate">{check.issue_description}</span>
                    <span className="text-[10px]">{new Date(check.resolved_at!).toLocaleDateString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </TabsContent>

        {/* ═══ GAPS TAB ═══ */}
        <TabsContent value="gaps" className="space-y-2">
          {openGaps.length === 0 && (
            <Card className="glass-card">
              <CardContent className="py-10 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nenhuma lacuna de dados detectada.</p>
              </CardContent>
            </Card>
          )}

          {/* Gaps table */}
          {openGaps.length > 0 && (
            <Card className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left p-3 text-muted-foreground font-medium">Tipo</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Campanha</th>
                      <th className="text-left p-3 text-muted-foreground font-medium">Período</th>
                      <th className="text-center p-3 text-muted-foreground font-medium">Registros</th>
                      <th className="text-center p-3 text-muted-foreground font-medium">Severidade</th>
                      <th className="text-right p-3 text-muted-foreground font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openGaps.map(gap => {
                      const gapCfg = GAP_TYPE_LABELS[gap.gap_type] || { label: gap.gap_type, emoji: '⚪' };
                      const sevCfg = SEVERITY_CONFIG[gap.severity] || SEVERITY_CONFIG.medium;
                      return (
                        <tr key={gap.id} className="border-b border-border/10 hover:bg-secondary/10">
                          <td className="p-3">
                            <span>{gapCfg.emoji} {gapCfg.label}</span>
                          </td>
                          <td className="p-3 text-foreground max-w-[180px] truncate">
                            {gap.campaign_name || gap.campaign_id || '—'}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {gap.date_from && gap.date_to
                              ? `${new Date(gap.date_from).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} → ${new Date(gap.date_to).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                              : '—'}
                          </td>
                          <td className="p-3 text-center font-medium text-foreground">
                            {gap.affected_records}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={`text-[10px] ${
                              gap.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                              gap.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' :
                              gap.severity === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                              'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}>
                              {gap.severity}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => resolveGap(gap.id)}>
                              <Check className="h-3 w-3 mr-1" /> Resolver
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Gap notes */}
              {openGaps.filter(g => g.notes).length > 0 && (
                <div className="p-3 border-t border-border/20 space-y-1">
                  {openGaps.filter(g => g.notes).map(g => (
                    <p key={g.id} className="text-[10px] text-muted-foreground">
                      • {g.notes}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Resolved gaps */}
          {gaps.filter(g => g.status === 'resolved').length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                {gaps.filter(g => g.status === 'resolved').length} lacunas resolvidas
              </summary>
              <div className="mt-2 space-y-1">
                {gaps.filter(g => g.status === 'resolved').slice(0, 10).map(g => (
                  <div key={g.id} className="flex items-center gap-2 text-xs text-muted-foreground/70 py-1 px-2 rounded bg-secondary/10">
                    <CheckCircle className="h-3 w-3 text-emerald-400/50" />
                    <span className="flex-1 truncate">{GAP_TYPE_LABELS[g.gap_type]?.label || g.gap_type}: {g.notes || g.campaign_name || '—'}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </TabsContent>

        {/* ═══ META 2026 COMPLIANCE ═══ */}
        <TabsContent value="compliance" className="space-y-3">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Meta 2026 — Checklist de Conformidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {compliance2026.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    item.passed
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  {item.passed ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                  )}
                  <span className={`text-sm flex-1 ${item.passed ? 'text-foreground' : 'text-red-400 font-medium'}`}>
                    {item.label}
                  </span>
                  {!item.passed && (
                    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                      Ação necessária
                    </Badge>
                  )}
                </div>
              ))}

              <div className="mt-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
                <p className="text-xs text-muted-foreground">
                  <strong>Nota:</strong> Este checklist verifica automaticamente a conformidade com as mudanças da API do Meta para 2026.
                  Execute uma verificação para atualizar os resultados.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
