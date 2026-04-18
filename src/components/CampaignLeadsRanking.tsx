import { useEffect, useMemo, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Users, DollarSign, Target, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/lib/workspace';

interface CampaignRow {
  campaign_id: string;
  name: string;
  status: string;
  leads: number;
  spend: number;
  impressions: number;
  clicks: number;
  cpl: number;
  ctr: number;
  cpm: number;
  leadAdsCount: number; // from meta_leads
}

interface Props {
  workspaceIdOverride?: string;
}

const PERIODS = [
  { key: '7', label: '7 dias' },
  { key: '14', label: '14 dias' },
  { key: '30', label: '30 dias' },
  { key: '90', label: '90 dias' },
];

export default function CampaignLeadsRanking({ workspaceIdOverride }: Props) {
  const { workspace } = useWorkspace();
  const wsId = workspaceIdOverride || workspace?.id;
  const [period, setPeriod] = useState('30');
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId) return;
    const load = async () => {
      setLoading(true);
      try {
        const days = parseInt(period, 10);
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString().slice(0, 10);

        // 1. Active campaigns
        const { data: campaigns } = await supabase
          .from('meta_campaigns')
          .select('campaign_id, name, effective_status, status')
          .eq('workspace_id', wsId);

        const activeCampaigns = (campaigns || []).filter(c => {
          const eff = (c.effective_status || c.status || '').toUpperCase();
          return eff === 'ACTIVE';
        });

        if (activeCampaigns.length === 0) {
          setRows([]);
          return;
        }

        const activeIds = activeCampaigns.map(c => c.campaign_id);

        // 2. Aggregate insights by campaign
        const { data: insights } = await supabase
          .from('facts_meta_insights_daily')
          .select('campaign_id, results_leads, spend, impressions, clicks')
          .eq('workspace_id', wsId)
          .gte('date', sinceStr)
          .in('campaign_id', activeIds);

        const agg: Record<string, { leads: number; spend: number; impressions: number; clicks: number }> = {};
        for (const r of insights || []) {
          const id = r.campaign_id;
          if (!agg[id]) agg[id] = { leads: 0, spend: 0, impressions: 0, clicks: 0 };
          agg[id].leads += Number(r.results_leads) || 0;
          agg[id].spend += Number(r.spend) || 0;
          agg[id].impressions += Number(r.impressions) || 0;
          agg[id].clicks += Number(r.clicks) || 0;
        }

        // 3. Lead Ads form leads (if any)
        const { data: leadAdsRows } = await supabase
          .from('meta_leads')
          .select('campaign_id')
          .eq('workspace_id', wsId)
          .gte('created_time', since.toISOString())
          .in('campaign_id', activeIds);

        const leadAdsMap: Record<string, number> = {};
        for (const r of leadAdsRows || []) {
          if (r.campaign_id) leadAdsMap[r.campaign_id] = (leadAdsMap[r.campaign_id] || 0) + 1;
        }

        const result: CampaignRow[] = activeCampaigns.map(c => {
          const a = agg[c.campaign_id] || { leads: 0, spend: 0, impressions: 0, clicks: 0 };
          return {
            campaign_id: c.campaign_id,
            name: c.name,
            status: 'ACTIVE',
            leads: a.leads,
            spend: a.spend,
            impressions: a.impressions,
            clicks: a.clicks,
            cpl: a.leads > 0 ? a.spend / a.leads : 0,
            ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
            cpm: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0,
            leadAdsCount: leadAdsMap[c.campaign_id] || 0,
          };
        }).sort((a, b) => b.leads - a.leads);

        setRows(result);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [wsId, period]);

  const totals = useMemo(() => {
    const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const best = rows.find(r => r.leads > 0);
    const noLeads = rows.filter(r => r.leads === 0 && r.spend > 0).length;
    return { totalLeads, totalSpend, avgCpl, best, noLeads, totalCampaigns: rows.length };
  }, [rows]);

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n));
  const fmtMoney = (n: number) => `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
  const fmtPct = (n: number) => `${n.toFixed(2)}%`;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Leads gerados', value: fmt(totals.totalLeads), icon: Users, color: 'text-primary', sub: `${totals.totalCampaigns} campanhas ativas` },
          { label: 'Investimento', value: fmtMoney(totals.totalSpend), icon: DollarSign, color: 'text-accent-foreground', sub: `${period} dias` },
          { label: 'CPL médio', value: totals.avgCpl > 0 ? fmtMoney(totals.avgCpl) : '—', icon: Target, color: 'text-positive', sub: 'custo por lead' },
          { label: 'Sem leads', value: String(totals.noLeads), icon: AlertCircle, color: totals.noLeads > 0 ? 'text-negative' : 'text-muted-foreground', sub: 'campanhas com gasto' },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{k.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{k.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Best campaign callout */}
      {totals.best && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-4 border-l-2 border-l-positive"
        >
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-positive" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Melhor campanha em leads</p>
              <p className="text-sm font-medium text-foreground truncate">{totals.best.name}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-positive">{fmt(totals.best.leads)} leads</p>
              <p className="text-[10px] text-muted-foreground">CPL {fmtMoney(totals.best.cpl)}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Ranking Table */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Ranking por campanha (ativas)</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Leads reportados pela API do Meta · campanhas em veiculação</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-8 w-28 text-xs bg-surface-2/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Carregando ranking…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma campanha ativa encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs w-10">#</TableHead>
                  <TableHead className="text-xs">Campanha</TableHead>
                  <TableHead className="text-xs text-right">Leads</TableHead>
                  <TableHead className="text-xs text-right">Investimento</TableHead>
                  <TableHead className="text-xs text-right">CPL</TableHead>
                  <TableHead className="text-xs text-right">CTR</TableHead>
                  <TableHead className="text-xs text-right">Form</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const isTop = i === 0 && r.leads > 0;
                  const noLeads = r.leads === 0 && r.spend > 0;
                  const gap = r.leads - r.leadAdsCount;
                  return (
                    <TableRow key={r.campaign_id} className="border-border hover:bg-surface-2/30">
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {isTop ? <Trophy className="h-3.5 w-3.5 text-positive" /> : i + 1}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground max-w-[280px]">
                        <span className="truncate block" title={r.name}>{r.name}</span>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        <span className={noLeads ? 'text-negative' : r.leads > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}>
                          {fmt(r.leads)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-muted-foreground">{fmtMoney(r.spend)}</TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {r.cpl > 0 ? fmtMoney(r.cpl) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-muted-foreground">{fmtPct(r.ctr)}</TableCell>
                      <TableCell className="text-xs text-right">
                        {r.leadAdsCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] font-mono" title={`${r.leadAdsCount} leads de formulário · gap ${gap}`}>
                            {r.leadAdsCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {totals.noLeads > 0 && (
          <div className="p-3 border-t border-border bg-negative/5 flex items-center gap-2 text-xs">
            <AlertCircle className="h-3.5 w-3.5 text-negative" />
            <span className="text-muted-foreground">
              <strong className="text-negative">{totals.noLeads}</strong> {totals.noLeads === 1 ? 'campanha ativa está consumindo orçamento sem gerar leads' : 'campanhas ativas estão consumindo orçamento sem gerar leads'} no período.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
