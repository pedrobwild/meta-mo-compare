import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Upload, TrendingUp, Target, DollarSign, Users, BarChart3, ArrowDownRight, ArrowUpRight, Bot, Sparkles, Filter, Clock, AlertTriangle, Phone, XCircle, CheckCircle, ChevronDown, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import Papa from 'papaparse';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

// Types
interface FunnelLead {
  id: string;
  workspace_id: string;
  lead_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  stage: string;
  stage_updated_at: string;
  contact_attempts: number;
  first_contact_at: string | null;
  time_to_first_contact_minutes: number | null;
  qualification_notes: string | null;
  lost_reason: string | null;
  deal_value: number;
  is_mql: boolean;
  is_sql: boolean;
  is_valid_contact: boolean;
}

interface StageHistory {
  id: string;
  lead_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
  notes: string | null;
  time_in_previous_stage_hours: number;
}

// Constants
const STAGES = ['lead', 'contacted', 'mql', 'sql', 'scheduled', 'closed_won', 'closed_lost'] as const;
const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', contacted: 'Contatado', mql: 'MQL', sql: 'SQL',
  scheduled: 'Agendado', closed_won: 'Fechado ✓', closed_lost: 'Perdido ✗',
};
const STAGE_COLORS: Record<string, string> = {
  lead: 'hsl(var(--chart-1))', contacted: 'hsl(var(--chart-2))', mql: 'hsl(var(--accent))',
  sql: 'hsl(var(--chart-3))', scheduled: 'hsl(var(--chart-4))', closed_won: 'hsl(var(--positive))',
  closed_lost: 'hsl(var(--destructive))',
};
const LOST_REASONS: Record<string, string> = {
  sem_perfil: 'Sem Perfil', sem_orcamento: 'Sem Orçamento', sem_timing: 'Sem Timing',
  nao_atendeu: 'Não Atendeu', concorrente: 'Concorrente', outro: 'Outro',
};
const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--accent))', 'hsl(var(--destructive))'];

function safe(n: number, d: number) { return d > 0 ? n / d : 0; }
function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function brl(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function semaforo(value: number, good: number, warn: number) {
  if (value >= good) return 'text-emerald-400';
  if (value >= warn) return 'text-amber-400';
  return 'text-red-400';
}

// ─── KPI Cards ─────────────────────────────────────────────
function KPICards({ leads }: { leads: FunnelLead[] }) {
  const total = leads.length;
  const contacted = leads.filter(l => l.contact_attempts > 0 || !['lead'].includes(l.stage)).length;
  const mqls = leads.filter(l => l.is_mql).length;
  const sqls = leads.filter(l => l.is_sql).length;
  const closedWon = leads.filter(l => l.stage === 'closed_won').length;
  const scheduled = leads.filter(l => ['scheduled', 'closed_won', 'closed_lost'].includes(l.stage)).length;
  const revenue = leads.filter(l => l.stage === 'closed_won').reduce((s, l) => s + Number(l.deal_value || 0), 0);

  const contactRate = safe(contacted, total) * 100;
  const mqlRate = safe(mqls, total) * 100;
  const sqlRate = safe(sqls, mqls) * 100;
  const closeRate = safe(closedWon, scheduled) * 100;

  const contactTimes = leads.filter(l => l.time_to_first_contact_minutes != null).map(l => l.time_to_first_contact_minutes!);
  const avgContactTime = contactTimes.length > 0 ? contactTimes.reduce((a, b) => a + b, 0) / contactTimes.length : 0;
  const slaUnder5 = contactTimes.length > 0 ? (contactTimes.filter(t => t <= 5).length / contactTimes.length) * 100 : 0;

  const cards = [
    { label: 'Total Leads', value: total.toString(), color: 'text-foreground', icon: Users },
    { label: 'Taxa Contato', value: `${contactRate.toFixed(1)}%`, color: semaforo(contactRate, 60, 40), icon: Phone },
    { label: '%MQL', value: `${mqlRate.toFixed(1)}%`, color: semaforo(mqlRate, 30, 15), icon: Target },
    { label: '%SQL', value: `${sqlRate.toFixed(1)}%`, color: 'text-foreground', icon: TrendingUp },
    { label: 'Taxa Fechamento', value: `${closeRate.toFixed(1)}%`, color: 'text-foreground', icon: CheckCircle },
    { label: 'ROAS Real', value: revenue > 0 ? `${(revenue / 1).toFixed(1)}x` : '—', color: 'text-foreground', icon: DollarSign },
    { label: 'Tempo 1º Contato', value: `${avgContactTime.toFixed(0)} min`, color: avgContactTime <= 5 ? 'text-emerald-400' : avgContactTime <= 30 ? 'text-amber-400' : 'text-red-400', icon: Clock },
    { label: 'SLA < 5 min', value: `${slaUnder5.toFixed(0)}%`, color: semaforo(slaUnder5, 70, 50), icon: AlertTriangle },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {cards.map((c, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
          <Card className="glass-panel">
            <CardContent className="p-2.5 flex flex-col items-center text-center gap-0.5">
              <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
              <p className={`text-base font-bold font-mono ${c.color}`}>{c.value}</p>
              <p className="text-[9px] text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Tab 1: Visual Funnel ──────────────────────────────────
function FunnelVisualTab({ leads }: { leads: FunnelLead[] }) {
  const funnelSteps = useMemo(() => {
    const total = leads.length;
    const contacted = leads.filter(l => l.contact_attempts > 0 || !['lead'].includes(l.stage)).length;
    const mqls = leads.filter(l => l.is_mql).length;
    const sqls = leads.filter(l => l.is_sql).length;
    const scheduled = leads.filter(l => ['scheduled', 'closed_won', 'closed_lost'].includes(l.stage)).length;
    const closedWon = leads.filter(l => l.stage === 'closed_won').length;
    const revenue = leads.filter(l => l.stage === 'closed_won').reduce((s, l) => s + Number(l.deal_value || 0), 0);

    return [
      { label: 'Leads Gerados', count: total, rate: null, rateLabel: '', color: 'hsl(var(--chart-1))' },
      { label: 'Contatados', count: contacted, rate: safe(contacted, total) * 100, rateLabel: 'Taxa de contato', color: 'hsl(var(--chart-2))' },
      { label: 'MQL', count: mqls, rate: safe(mqls, total) * 100, rateLabel: '%MQL', color: 'hsl(var(--accent))' },
      { label: 'SQL', count: sqls, rate: safe(sqls, mqls) * 100, rateLabel: '%SQL (dos MQL)', color: 'hsl(var(--chart-3))' },
      { label: 'Agendados', count: scheduled, rate: safe(scheduled, sqls) * 100, rateLabel: 'Taxa agend.', color: 'hsl(var(--chart-4))' },
      { label: 'Fechados (Won)', count: closedWon, rate: safe(closedWon, scheduled) * 100, rateLabel: 'Taxa fechamento', color: 'hsl(var(--positive))', extra: `Receita: ${brl(revenue)}` },
    ];
  }, [leads]);

  const maxCount = Math.max(...funnelSteps.map(s => s.count), 1);

  return (
    <div className="max-w-xl mx-auto space-y-1">
      {funnelSteps.map((step, i) => {
        const widthPct = Math.max((step.count / maxCount) * 100, 15);
        return (
          <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
            className="glass-panel p-3 relative overflow-hidden"
            style={{ width: `${widthPct}%`, minWidth: '250px', marginLeft: 'auto', marginRight: 'auto' }}
          >
            <div className="absolute inset-0 opacity-10" style={{ background: step.color }} />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">{step.label}</p>
                {step.rate !== null && (
                  <p className="text-[10px] text-muted-foreground">{step.rateLabel}: {step.rate.toFixed(1)}%</p>
                )}
                {step.extra && <p className="text-[10px] font-medium text-emerald-400">{step.extra}</p>}
              </div>
              <p className="text-xl font-bold font-mono text-foreground">{step.count}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Tab 2: By Source ──────────────────────────────────────
function BySourceTab({ leads }: { leads: FunnelLead[] }) {
  const data = useMemo(() => {
    const groups: Record<string, FunnelLead[]> = {};
    leads.forEach(l => { (groups[l.source || 'unknown'] ??= []).push(l); });

    return Object.entries(groups).map(([source, group]) => {
      const total = group.length;
      const contacted = group.filter(l => l.contact_attempts > 0 || !['lead'].includes(l.stage)).length;
      const mqls = group.filter(l => l.is_mql).length;
      const sqls = group.filter(l => l.is_sql).length;
      const closedWon = group.filter(l => l.stage === 'closed_won').length;
      const revenue = group.filter(l => l.stage === 'closed_won').reduce((s, l) => s + Number(l.deal_value || 0), 0);
      return {
        source, total, contacted,
        contactRate: safe(contacted, total) * 100,
        mqlRate: safe(mqls, total) * 100,
        sqlRate: safe(sqls, mqls) * 100,
        closedWon, revenue,
        roasReal: 0, // Would need spend
        costPerSale: 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [leads]);

  return (
    <div className="glass-panel overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px]">Origem</TableHead>
            <TableHead className="text-[10px] text-right">Leads</TableHead>
            <TableHead className="text-[10px] text-right">Contatados</TableHead>
            <TableHead className="text-[10px] text-right">%MQL</TableHead>
            <TableHead className="text-[10px] text-right">%SQL</TableHead>
            <TableHead className="text-[10px] text-right">Fechados</TableHead>
            <TableHead className="text-[10px] text-right">Receita</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(d => (
            <TableRow key={d.source}>
              <TableCell className="text-xs font-medium">{d.source}</TableCell>
              <TableCell className="text-xs font-mono text-right">{d.total}</TableCell>
              <TableCell className="text-xs font-mono text-right">{d.contacted} ({d.contactRate.toFixed(0)}%)</TableCell>
              <TableCell className={`text-xs font-mono text-right ${semaforo(d.mqlRate, 30, 15)}`}>{d.mqlRate.toFixed(1)}%</TableCell>
              <TableCell className="text-xs font-mono text-right">{d.sqlRate.toFixed(1)}%</TableCell>
              <TableCell className="text-xs font-mono text-right">{d.closedWon}</TableCell>
              <TableCell className="text-xs font-mono text-right text-emerald-400">{brl(d.revenue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Tab 3: By Campaign ────────────────────────────────────
function ByCampaignTab({ leads }: { leads: FunnelLead[] }) {
  const data = useMemo(() => {
    const groups: Record<string, FunnelLead[]> = {};
    leads.forEach(l => { (groups[l.utm_campaign || l.campaign_id || 'unknown'] ??= []).push(l); });

    return Object.entries(groups).map(([campaign, group]) => {
      const total = group.length;
      const mqls = group.filter(l => l.is_mql).length;
      const sqls = group.filter(l => l.is_sql).length;
      const closedWon = group.filter(l => l.stage === 'closed_won').length;
      const revenue = group.filter(l => l.stage === 'closed_won').reduce((s, l) => s + Number(l.deal_value || 0), 0);
      return {
        campaign, total, mqls, sqls, closedWon, revenue,
        mqlRate: safe(mqls, total) * 100,
        sqlRate: safe(sqls, mqls) * 100,
        closeRate: safe(closedWon, total) * 100,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [leads]);

  return (
    <div className="glass-panel overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px]">Campanha</TableHead>
            <TableHead className="text-[10px] text-right">Leads</TableHead>
            <TableHead className="text-[10px] text-right">MQL</TableHead>
            <TableHead className="text-[10px] text-right">SQL</TableHead>
            <TableHead className="text-[10px] text-right">Fechados</TableHead>
            <TableHead className="text-[10px] text-right">%MQL</TableHead>
            <TableHead className="text-[10px] text-right">Taxa Fecha.</TableHead>
            <TableHead className="text-[10px] text-right">Receita</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(d => (
            <TableRow key={d.campaign}>
              <TableCell className="text-xs font-medium max-w-[200px] truncate">{d.campaign}</TableCell>
              <TableCell className="text-xs font-mono text-right">{d.total}</TableCell>
              <TableCell className="text-xs font-mono text-right">{d.mqls}</TableCell>
              <TableCell className="text-xs font-mono text-right">{d.sqls}</TableCell>
              <TableCell className="text-xs font-mono text-right">{d.closedWon}</TableCell>
              <TableCell className={`text-xs font-mono text-right ${semaforo(d.mqlRate, 30, 15)}`}>{d.mqlRate.toFixed(1)}%</TableCell>
              <TableCell className="text-xs font-mono text-right">{d.closeRate.toFixed(1)}%</TableCell>
              <TableCell className="text-xs font-mono text-right text-emerald-400">{brl(d.revenue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Tab 4: Lead List ──────────────────────────────────────
function LeadListTab({ leads, onUpdateLead, onAnalyzeLead }: {
  leads: FunnelLead[];
  onUpdateLead: (lead: FunnelLead, updates: Partial<FunnelLead>) => void;
  onAnalyzeLead: (lead: FunnelLead) => void;
}) {
  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [detailLead, setDetailLead] = useState<FunnelLead | null>(null);
  const [history, setHistory] = useState<StageHistory[]>([]);

  const filtered = useMemo(() => {
    let list = leads;
    if (stageFilter !== 'all') list = list.filter(l => l.stage === stageFilter);
    if (sourceFilter !== 'all') list = list.filter(l => l.source === sourceFilter);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [leads, stageFilter, sourceFilter]);

  const sources = useMemo(() => [...new Set(leads.map(l => l.source || 'unknown'))], [leads]);

  const openDetail = async (lead: FunnelLead) => {
    setDetailLead(lead);
    const { data } = await supabase
      .from('funnel_stage_history')
      .select('*')
      .eq('lead_id', lead.id)
      .order('changed_at', { ascending: true });
    setHistory((data as any[]) || []);
  };

  const daysInStage = (lead: FunnelLead) => {
    const diff = Date.now() - new Date(lead.stage_updated_at).getTime();
    return Math.floor(diff / 86400000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-7 w-32 text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todas etapas</SelectItem>
            {STAGES.map(s => <SelectItem key={s} value={s} className="text-xs">{STAGE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todas fontes</SelectItem>
            {sources.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Nome</TableHead>
                <TableHead className="text-[10px]">Fonte</TableHead>
                <TableHead className="text-[10px]">Campanha</TableHead>
                <TableHead className="text-[10px]">Etapa</TableHead>
                <TableHead className="text-[10px] text-right">Dias</TableHead>
                <TableHead className="text-[10px] text-right">Tentativas</TableHead>
                <TableHead className="text-[10px] text-right">1º Contato</TableHead>
                <TableHead className="text-[10px] text-right">Valor</TableHead>
                <TableHead className="text-[10px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map(lead => (
                <TableRow key={lead.id} className={lead.stage === 'closed_lost' ? 'opacity-60' : ''}>
                  <TableCell className="text-xs font-medium cursor-pointer hover:text-primary" onClick={() => openDetail(lead)}>
                    {lead.name || lead.email || lead.lead_id}
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">{lead.source}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground max-w-[120px] truncate">{lead.utm_campaign || '—'}</TableCell>
                  <TableCell>
                    <Select
                      value={lead.stage}
                      onValueChange={v => onUpdateLead(lead, { stage: v })}
                    >
                      <SelectTrigger className="h-6 w-28 text-[10px] border-0 bg-transparent p-0">
                        <Badge variant="outline" className="text-[9px]" style={{ borderColor: STAGE_COLORS[lead.stage] }}>
                          {STAGE_LABELS[lead.stage]}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map(s => <SelectItem key={s} value={s} className="text-xs">{STAGE_LABELS[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-right">{daysInStage(lead)}d</TableCell>
                  <TableCell className="text-xs font-mono text-right">{lead.contact_attempts}</TableCell>
                  <TableCell className={`text-xs font-mono text-right ${lead.time_to_first_contact_minutes != null && lead.time_to_first_contact_minutes <= 5 ? 'text-emerald-400' : lead.time_to_first_contact_minutes != null && lead.time_to_first_contact_minutes > 30 ? 'text-red-400' : ''}`}>
                    {lead.time_to_first_contact_minutes != null ? `${lead.time_to_first_contact_minutes}m` : '—'}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-right">{lead.deal_value > 0 ? brl(lead.deal_value) : '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAnalyzeLead(lead)}>
                      <Bot className="h-3 w-3 text-primary" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 100 && <p className="text-[10px] text-muted-foreground text-center py-2">Mostrando 100 de {filtered.length}</p>}
      </div>

      {/* Lead Detail Dialog */}
      <Dialog open={!!detailLead} onOpenChange={v => !v && setDetailLead(null)}>
        <DialogContent className="glass-panel max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-sm">{detailLead?.name || detailLead?.lead_id}</DialogTitle>
          </DialogHeader>
          {detailLead && (
            <ScrollArea className="max-h-[60vh] space-y-3">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Email:</span> {detailLead.email || '—'}</div>
                  <div><span className="text-muted-foreground">Telefone:</span> {detailLead.phone || '—'}</div>
                  <div><span className="text-muted-foreground">Fonte:</span> {detailLead.source}</div>
                  <div><span className="text-muted-foreground">Etapa:</span> {STAGE_LABELS[detailLead.stage]}</div>
                  <div><span className="text-muted-foreground">UTM Campaign:</span> {detailLead.utm_campaign || '—'}</div>
                  <div><span className="text-muted-foreground">UTM Content:</span> {detailLead.utm_content || '—'}</div>
                  <div><span className="text-muted-foreground">Tentativas:</span> {detailLead.contact_attempts}</div>
                  <div><span className="text-muted-foreground">Valor:</span> {detailLead.deal_value > 0 ? brl(detailLead.deal_value) : '—'}</div>
                </div>
                {detailLead.qualification_notes && (
                  <div className="glass-panel p-2"><p className="text-[10px] text-muted-foreground">Notas:</p><p className="text-xs">{detailLead.qualification_notes}</p></div>
                )}
                {detailLead.lost_reason && (
                  <div className="glass-panel p-2 border-red-500/20"><p className="text-[10px] text-red-400">Motivo de perda: {LOST_REASONS[detailLead.lost_reason] || detailLead.lost_reason}</p></div>
                )}
                <div>
                  <p className="text-xs font-semibold mb-2">Histórico de Etapas</p>
                  {history.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">Sem histórico registrado.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {history.map(h => (
                        <div key={h.id} className="flex items-center gap-2 text-[10px]">
                          <span className="text-muted-foreground w-24">{new Date(h.changed_at).toLocaleDateString('pt-BR')}</span>
                          <Badge variant="outline" className="text-[9px]">{STAGE_LABELS[h.from_stage || ''] || '—'}</Badge>
                          <span>→</span>
                          <Badge variant="outline" className="text-[9px]">{STAGE_LABELS[h.to_stage]}</Badge>
                          {h.time_in_previous_stage_hours > 0 && <span className="text-muted-foreground">({h.time_in_previous_stage_hours.toFixed(0)}h)</span>}
                          {h.notes && <span className="text-muted-foreground italic">{h.notes}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 5: Lost Reasons ───────────────────────────────────
function LostReasonsTab({ leads }: { leads: FunnelLead[] }) {
  const lostLeads = leads.filter(l => l.stage === 'closed_lost');
  const reasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    lostLeads.forEach(l => {
      const reason = l.lost_reason || 'outro';
      counts[reason] = (counts[reason] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([reason, count]) => ({ name: LOST_REASONS[reason] || reason, value: count, reason }))
      .sort((a, b) => b.value - a.value);
  }, [lostLeads]);

  // By campaign breakdown
  const byCampaign = useMemo(() => {
    const groups: Record<string, Record<string, number>> = {};
    lostLeads.forEach(l => {
      const campaign = l.utm_campaign || l.campaign_id || 'unknown';
      const reason = l.lost_reason || 'outro';
      if (!groups[campaign]) groups[campaign] = {};
      groups[campaign][reason] = (groups[campaign][reason] || 0) + 1;
    });
    return Object.entries(groups).map(([campaign, reasons]) => ({
      campaign,
      total: Object.values(reasons).reduce((a, b) => a + b, 0),
      reasons,
    })).sort((a, b) => b.total - a.total);
  }, [lostLeads]);

  if (lostLeads.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead perdido registrado.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart */}
        <div className="glass-panel p-4">
          <h4 className="text-xs font-semibold mb-3">Motivos de Perda</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie data={reasonCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {reasonCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="glass-panel p-4">
          <h4 className="text-xs font-semibold mb-3">Volume por Motivo</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasonCounts} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} width={75} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* By Campaign */}
      <div className="glass-panel overflow-hidden">
        <div className="p-3 border-b border-border/40">
          <h4 className="text-xs font-semibold">Perdas por Campanha</h4>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Campanha</TableHead>
              <TableHead className="text-[10px] text-right">Total Perdas</TableHead>
              {Object.values(LOST_REASONS).map(r => <TableHead key={r} className="text-[10px] text-right">{r}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {byCampaign.slice(0, 10).map(row => (
              <TableRow key={row.campaign}>
                <TableCell className="text-xs max-w-[180px] truncate">{row.campaign}</TableCell>
                <TableCell className="text-xs font-mono text-right font-bold">{row.total}</TableCell>
                {Object.keys(LOST_REASONS).map(r => (
                  <TableCell key={r} className="text-xs font-mono text-right">{row.reasons[r] || 0}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Tab 6: SLA ────────────────────────────────────────────
function SLATab({ leads }: { leads: FunnelLead[] }) {
  const contactTimes = leads.filter(l => l.time_to_first_contact_minutes != null).map(l => l.time_to_first_contact_minutes!);
  
  const slaUnder5 = contactTimes.length > 0 ? (contactTimes.filter(t => t <= 5).length / contactTimes.length) * 100 : 0;
  const with6Attempts = leads.filter(l => l.contact_attempts >= 6).length;
  const attemptRate = leads.length > 0 ? (with6Attempts / leads.length) * 100 : 0;

  const distribution = useMemo(() => {
    const bins = [
      { label: '< 5 min', min: 0, max: 5, count: 0 },
      { label: '5-30 min', min: 5, max: 30, count: 0 },
      { label: '30min-2h', min: 30, max: 120, count: 0 },
      { label: '2h-24h', min: 120, max: 1440, count: 0 },
      { label: '> 24h', min: 1440, max: Infinity, count: 0 },
    ];
    contactTimes.forEach(t => {
      const bin = bins.find(b => t >= b.min && t < b.max);
      if (bin) bin.count++;
    });
    return bins;
  }, [contactTimes]);

  // Correlation: contact time vs MQL rate
  const correlation = useMemo(() => {
    const bins = [
      { label: '< 5m', leads: [] as FunnelLead[] },
      { label: '5-30m', leads: [] as FunnelLead[] },
      { label: '30m-2h', leads: [] as FunnelLead[] },
      { label: '> 2h', leads: [] as FunnelLead[] },
    ];
    leads.filter(l => l.time_to_first_contact_minutes != null).forEach(l => {
      const t = l.time_to_first_contact_minutes!;
      if (t < 5) bins[0].leads.push(l);
      else if (t < 30) bins[1].leads.push(l);
      else if (t < 120) bins[2].leads.push(l);
      else bins[3].leads.push(l);
    });
    return bins.map(b => ({
      label: b.label,
      leads: b.leads.length,
      mqlRate: b.leads.length > 0 ? (b.leads.filter(l => l.is_mql).length / b.leads.length) * 100 : 0,
    }));
  }, [leads]);

  // Alerts
  const contactRate = leads.length > 0 ? (leads.filter(l => l.contact_attempts > 0).length / leads.length) * 100 : 0;
  const leadsWithout24h = leads.filter(l => {
    if (l.contact_attempts > 0 || ['closed_won', 'closed_lost'].includes(l.stage)) return false;
    const hours = (Date.now() - new Date(l.created_at).getTime()) / 3600000;
    return hours > 24;
  });

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {contactRate < 60 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-3 border-amber-500/30 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <p className="text-xs text-amber-400">⚠️ Taxa de contato em {contactRate.toFixed(0)}% — abaixo do mínimo de 60%</p>
        </motion.div>
      )}
      {slaUnder5 < 70 && contactTimes.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-3 border-red-500/30 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <p className="text-xs text-red-400">🔴 SLA crítico: apenas {slaUnder5.toFixed(0)}% dos leads contatados em menos de 5 min</p>
        </motion.div>
      )}
      {leadsWithout24h.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-3 border-red-500/30 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <p className="text-xs text-red-400">🔴 {leadsWithout24h.length} lead(s) sem contato há mais de 24h</p>
        </motion.div>
      )}

      {/* SLA KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="glass-panel">
          <CardContent className="p-4 text-center space-y-1">
            <p className="text-[10px] text-muted-foreground">SLA &lt; 5 minutos</p>
            <p className={`text-2xl font-bold font-mono ${semaforo(slaUnder5, 70, 50)}`}>{slaUnder5.toFixed(0)}%</p>
            <p className="text-[9px] text-muted-foreground">Meta: 100%</p>
            <Progress value={slaUnder5} className="h-1.5" />
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4 text-center space-y-1">
            <p className="text-[10px] text-muted-foreground">≥ 6 tentativas</p>
            <p className={`text-2xl font-bold font-mono ${semaforo(attemptRate, 70, 50)}`}>{attemptRate.toFixed(0)}%</p>
            <p className="text-[9px] text-muted-foreground">Meta: 100%</p>
            <Progress value={attemptRate} className="h-1.5" />
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardContent className="p-4 text-center space-y-1">
            <p className="text-[10px] text-muted-foreground">Tempo médio 1º contato</p>
            <p className={`text-2xl font-bold font-mono ${contactTimes.length > 0 ? (contactTimes.reduce((a, b) => a + b, 0) / contactTimes.length <= 5 ? 'text-emerald-400' : 'text-amber-400') : 'text-muted-foreground'}`}>
              {contactTimes.length > 0 ? `${(contactTimes.reduce((a, b) => a + b, 0) / contactTimes.length).toFixed(0)} min` : '—'}
            </p>
            <p className="text-[9px] text-muted-foreground">Meta: ≤ 5 min</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Chart */}
      <div className="glass-panel p-4 space-y-2">
        <h4 className="text-xs font-semibold">Distribuição: Tempo até 1º Contato</h4>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Correlation */}
      <div className="glass-panel p-4 space-y-2">
        <h4 className="text-xs font-semibold">Correlação: Tempo de Contato × %MQL</h4>
        <p className="text-[10px] text-muted-foreground">Quanto mais rápido o contato, maior a taxa de qualificação</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={correlation}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(1)}%`, '%MQL']} />
              <Bar dataKey="mqlRate" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Analysis Modal ────────────────────────────────────────
function FunnelAnalysisModal({ open, onClose, leads, mode, selectedLead }: {
  open: boolean;
  onClose: () => void;
  leads: FunnelLead[];
  mode: 'funnel' | 'lead';
  selectedLead?: FunnelLead | null;
}) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnalysis('');
    setLoading(true);

    const run = async () => {
      try {
        let body: any = { mode };

        if (mode === 'funnel') {
          const total = leads.length;
          const contacted = leads.filter(l => l.contact_attempts > 0).length;
          const mqls = leads.filter(l => l.is_mql).length;
          const sqls = leads.filter(l => l.is_sql).length;
          const scheduled = leads.filter(l => ['scheduled', 'closed_won', 'closed_lost'].includes(l.stage)).length;
          const closedWon = leads.filter(l => l.stage === 'closed_won').length;
          const revenue = leads.filter(l => l.stage === 'closed_won').reduce((s, l) => s + Number(l.deal_value || 0), 0);
          const contactTimes = leads.filter(l => l.time_to_first_contact_minutes != null).map(l => l.time_to_first_contact_minutes!);

          const lostReasons: Record<string, number> = {};
          leads.filter(l => l.lost_reason).forEach(l => { lostReasons[l.lost_reason!] = (lostReasons[l.lost_reason!] || 0) + 1; });

          body.funnelData = {
            total_leads: total, contacted,
            contact_rate: safe(contacted, total) * 100,
            mql_count: mqls, mql_rate: safe(mqls, total) * 100,
            sql_count: sqls, sql_rate: safe(sqls, mqls) * 100,
            scheduled, schedule_rate: safe(scheduled, sqls) * 100,
            closed_won: closedWon, close_rate: safe(closedWon, scheduled) * 100,
            total_revenue: revenue, roas_real: 0,
            avg_contact_time: contactTimes.length > 0 ? contactTimes.reduce((a, b) => a + b, 0) / contactTimes.length : 0,
            sla_pct: contactTimes.length > 0 ? (contactTimes.filter(t => t <= 5).length / contactTimes.length) * 100 : 0,
            lost_reasons: lostReasons,
          };
        } else if (mode === 'lead' && selectedLead) {
          const daysInStage = Math.floor((Date.now() - new Date(selectedLead.stage_updated_at).getTime()) / 86400000);
          const { data: history } = await supabase
            .from('funnel_stage_history')
            .select('*')
            .eq('lead_id', selectedLead.id)
            .order('changed_at', { ascending: true });

          body.leadData = {
            ...selectedLead,
            days_in_stage: daysInStage,
            stage_history: history || [],
          };
        }

        const resp = await supabase.functions.invoke('analyze-funnel', { body });
        if (resp.error) throw resp.error;

        const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        const lines = text.split('\n');
        let fullText = '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) fullText += parsed.delta.text;
            } catch { /* skip */ }
          }
        }
        setAnalysis(fullText || (resp.data?.content?.[0]?.text) || text);
      } catch (e: any) {
        setAnalysis(`Erro: ${e.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-panel max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            {mode === 'funnel' ? 'Análise do Funil' : `Análise — ${selectedLead?.name || selectedLead?.lead_id}`}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-sm text-muted-foreground">Analisando...</span>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown>{analysis}</ReactMarkdown>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ────────────────────────────────────────
export default function FunnelRealView() {
  const { workspace, user } = useWorkspace();
  const [leads, setLeads] = useState<FunnelLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'funnel' | 'lead' | null>(null);
  const [selectedLead, setSelectedLead] = useState<FunnelLead | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLeads = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const { data } = await supabase
      .from('funnel_leads')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });
    setLeads((data as any[]) || []);
    setLoading(false);
  }, [workspace]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleUpdateLead = async (lead: FunnelLead, updates: Partial<FunnelLead>) => {
    if (!workspace || !user) return;
    try {
      const prevStage = lead.stage;
      const now = new Date().toISOString();
      const updateData: any = { ...updates, stage_updated_at: now };

      // Auto-set MQL/SQL flags
      if (updates.stage) {
        if (['mql', 'sql', 'scheduled', 'closed_won'].includes(updates.stage)) updateData.is_mql = true;
        if (['sql', 'scheduled', 'closed_won'].includes(updates.stage)) updateData.is_sql = true;

        // Record history
        const prevTime = lead.stage_updated_at ? (new Date(now).getTime() - new Date(lead.stage_updated_at).getTime()) / 3600000 : 0;
        await supabase.from('funnel_stage_history').insert({
          workspace_id: workspace.id,
          lead_id: lead.id,
          from_stage: prevStage,
          to_stage: updates.stage,
          changed_at: now,
          changed_by: user.id,
          time_in_previous_stage_hours: Math.round(prevTime * 100) / 100,
        });
      }

      await supabase.from('funnel_leads').update(updateData).eq('id', lead.id);
      toast.success('Lead atualizado');
      loadLeads();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace) return;
    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          const records = result.data.map((row: any) => ({
            workspace_id: workspace.id,
            lead_id: row.lead_id || crypto.randomUUID(),
            name: row.name || row.nome || null,
            email: row.email || null,
            phone: row.phone || row.telefone || null,
            source: row.utm_source || row.source || 'csv',
            utm_source: row.utm_source || null,
            utm_medium: row.utm_medium || null,
            utm_campaign: row.utm_campaign || null,
            utm_content: row.utm_content || null,
            utm_term: row.utm_term || null,
            campaign_id: row.campaign_id || null,
            stage: row.stage || 'lead',
            stage_updated_at: row.stage_date || new Date().toISOString(),
            contact_attempts: Number(row.contact_attempts) || 0,
            first_contact_at: row.first_contact_at || null,
            time_to_first_contact_minutes: row.first_contact_at ? null : null,
            deal_value: Number(row.deal_value) || 0,
            lost_reason: row.lost_reason || null,
            is_mql: ['mql', 'sql', 'scheduled', 'closed_won'].includes(row.stage),
            is_sql: ['sql', 'scheduled', 'closed_won'].includes(row.stage),
            is_valid_contact: true,
          }));

          const { error } = await supabase.from('funnel_leads').upsert(records, { onConflict: 'workspace_id,lead_id' });
          if (error) throw error;
          toast.success(`${records.length} leads importados`);
          setImportOpen(false);
          loadLeads();
        } catch (err: any) {
          toast.error(`Erro: ${err.message}`);
        } finally {
          setImporting(false);
          if (fileRef.current) fileRef.current.value = '';
        }
      },
      error: (err) => {
        toast.error(`Erro CSV: ${err.message}`);
        setImporting(false);
      },
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh]"><div className="animate-pulse text-muted-foreground text-sm">Carregando funil...</div></div>;
  }

  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 max-w-md mx-auto">
          <div className="h-20 w-20 mx-auto rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Users className="h-10 w-10 text-accent" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Funil Real de Negócio</h2>
            <p className="text-sm text-muted-foreground">
              Importe leads do CRM para rastrear qualidade, SLA e ROAS Real.
              <br /><span className="text-foreground/60">O Meta mede cliques — este painel mede o que realmente importa.</span>
            </p>
          </div>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Upload className="h-4 w-4" /> Importar CSV de Leads
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel">
              <DialogHeader><DialogTitle>Importar Leads</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-xs text-muted-foreground">
                  CSV com colunas: <span className="font-mono text-foreground/70">lead_id, name, email, phone, stage, stage_date, deal_value, lost_reason, contact_attempts, first_contact_at, utm_source, utm_campaign</span>
                </p>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCSV}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                {importing && <p className="text-xs text-primary animate-pulse">Importando...</p>}
              </div>
            </DialogContent>
          </Dialog>
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">Leads → MQL → SQL → Fechamento → Receita</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Funil Real de Negócio</h2>
          <p className="text-xs text-muted-foreground">{leads.length} leads • Qualidade e ROAS Real</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1" onClick={() => { setAnalysisMode('funnel'); setSelectedLead(null); }}>
            <Sparkles className="h-3 w-3" /> Analisar Funil
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-[10px] h-7 gap-1">
                <Upload className="h-3.5 w-3.5" /> Importar CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel">
              <DialogHeader><DialogTitle>Importar Leads</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-xs text-muted-foreground">
                  CSV com colunas: <span className="font-mono text-foreground/70">lead_id, name, email, phone, stage, stage_date, deal_value, lost_reason, contact_attempts, first_contact_at, utm_source, utm_campaign</span>
                </p>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCSV}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                {importing && <p className="text-xs text-primary animate-pulse">Importando...</p>}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards leads={leads} />

      {/* Tabs */}
      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList className="bg-muted/30 p-0.5 flex-wrap">
          <TabsTrigger value="funnel" className="text-xs gap-1"><BarChart3 className="h-3 w-3" /> Funil Visual</TabsTrigger>
          <TabsTrigger value="source" className="text-xs gap-1"><Target className="h-3 w-3" /> Por Origem</TabsTrigger>
          <TabsTrigger value="campaign" className="text-xs gap-1"><TrendingUp className="h-3 w-3" /> Por Campanha</TabsTrigger>
          <TabsTrigger value="leads" className="text-xs gap-1"><Users className="h-3 w-3" /> Lista de Leads</TabsTrigger>
          <TabsTrigger value="lost" className="text-xs gap-1"><XCircle className="h-3 w-3" /> Motivos de Perda</TabsTrigger>
          <TabsTrigger value="sla" className="text-xs gap-1"><Clock className="h-3 w-3" /> SLA de Vendas</TabsTrigger>
        </TabsList>

        <TabsContent value="funnel"><FunnelVisualTab leads={leads} /></TabsContent>
        <TabsContent value="source"><BySourceTab leads={leads} /></TabsContent>
        <TabsContent value="campaign"><ByCampaignTab leads={leads} /></TabsContent>
        <TabsContent value="leads">
          <LeadListTab
            leads={leads}
            onUpdateLead={handleUpdateLead}
            onAnalyzeLead={(lead) => { setSelectedLead(lead); setAnalysisMode('lead'); }}
          />
        </TabsContent>
        <TabsContent value="lost"><LostReasonsTab leads={leads} /></TabsContent>
        <TabsContent value="sla"><SLATab leads={leads} /></TabsContent>
      </Tabs>

      {/* Analysis Modal */}
      {analysisMode && (
        <FunnelAnalysisModal
          open={!!analysisMode}
          onClose={() => { setAnalysisMode(null); setSelectedLead(null); }}
          leads={leads}
          mode={analysisMode}
          selectedLead={selectedLead}
        />
      )}
    </div>
  );
}
