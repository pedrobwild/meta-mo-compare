import { useState, useMemo } from 'react';
import { AlertTriangle, Edit2, Check, X, Filter, Palette, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { useWorkspace } from '@/lib/workspace';
import { supabase } from '@/integrations/supabase/client';
import type { CreativeLifecycleRecord, CreativeStatus, MetaRecord } from '@/lib/types';
import { CREATIVE_LIFESPAN } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const STATUS_CONFIG: Record<CreativeStatus, { label: string; class: string; bgClass: string }> = {
  fresh: { label: 'FRESH', class: 'text-positive', bgClass: 'bg-positive/15 text-positive border-positive/30' },
  peaking: { label: 'PEAKING', class: 'text-primary', bgClass: 'bg-primary/15 text-primary border-primary/30' },
  declining: { label: 'DECLINING', class: 'text-warning', bgClass: 'bg-warning/15 text-warning border-warning/30' },
  fatigued: { label: 'FATIGUED', class: 'text-destructive', bgClass: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const FORMAT_OPTIONS = ['video', 'image', 'carousel', 'stories'];
const HOOK_OPTIONS = ['problema', 'social_proof', 'oferta', 'bastidor'];

function safe(n: number, d: number) { return d > 0 ? n / d : 0; }
function pct(v: number) { return `${(v * 100).toFixed(2)}%`; }
function brl(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`; }

interface AdAggregate {
  ad_key: string;
  ad_name: string;
  campaign_key: string | null;
  campaign_name: string | null;
  spend_brl: number;
  impressions: number;
  link_clicks: number;
  landing_page_views: number;
  results: number;
  ctr_link: number;
  cpm: number;
  lpv_rate: number;
  cpa: number;
  // Lifecycle data (from creative_lifecycle table or computed)
  days_active: number;
  peak_ctr: number;
  current_ctr: number;
  degradation_pct: number;
  status: CreativeStatus;
  format: string | null;
  hook_type: string | null;
  lifecycle_id: string | null;
}

function computeStatus(days: number, degradation: number, currentCtr: number, peakCtr: number): CreativeStatus {
  if (days < 7) return 'fresh';
  if (degradation > 30) return 'fatigued';
  if (degradation > 15) return 'declining';
  if (currentCtr >= peakCtr * 0.95) return 'peaking';
  return 'declining';
}

function aggregateAds(records: MetaRecord[], lifecycleMap: Map<string, CreativeLifecycleRecord>): AdAggregate[] {
  const grouped: Record<string, MetaRecord[]> = {};
  for (const r of records) {
    (grouped[r.ad_key] ??= []).push(r);
  }

  return Object.entries(grouped).map(([ad_key, rows]) => {
    const spend_brl = rows.reduce((s, r) => s + r.spend_brl, 0);
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    const link_clicks = rows.reduce((s, r) => s + r.link_clicks, 0);
    const landing_page_views = rows.reduce((s, r) => s + r.landing_page_views, 0);
    const results = rows.reduce((s, r) => s + r.results, 0);
    const ctr_link = safe(link_clicks, impressions) * 100;
    const cpm = safe(spend_brl, impressions) * 1000;
    const lpv_rate = safe(landing_page_views, link_clicks);
    const cpa = safe(spend_brl, results);

    const lc = lifecycleMap.get(ad_key);

    // Compute days active from data range
    const dates = rows.map(r => r.period_start).filter(Boolean).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const daysFromData = firstDate && lastDate
      ? Math.max(1, Math.ceil((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000))
      : 1;

    const days_active = lc?.days_active || daysFromData;
    const peak_ctr = lc?.peak_ctr || ctr_link;
    const current_ctr = lc?.current_ctr || ctr_link;
    const degradation_pct = lc?.degradation_pct || (peak_ctr > 0 ? Math.max(0, ((peak_ctr - current_ctr) / peak_ctr) * 100) : 0);
    const status = (lc?.status as CreativeStatus) || computeStatus(days_active, degradation_pct, current_ctr, peak_ctr);

    return {
      ad_key,
      ad_name: rows[0].ad_name,
      campaign_key: rows[0].campaign_key,
      campaign_name: rows[0].campaign_name,
      spend_brl, impressions, link_clicks, landing_page_views, results,
      ctr_link, cpm, lpv_rate, cpa,
      days_active, peak_ctr, current_ctr, degradation_pct, status,
      format: lc?.format || null,
      hook_type: lc?.hook_type || null,
      lifecycle_id: lc?.id || null,
    };
  });
}

function StatusBadge({ status }: { status: CreativeStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.fresh;
  return <Badge variant="outline" className={`text-[10px] font-mono border ${cfg.bgClass}`}>{cfg.label}</Badge>;
}

function LifecycleProgress({ daysActive, format }: { daysActive: number; format: string | null }) {
  const lifespan = CREATIVE_LIFESPAN[format || 'default'] || CREATIVE_LIFESPAN.default;
  const progress = Math.min((daysActive / lifespan) * 100, 100);
  return (
    <div className="space-y-0.5">
      <Progress value={progress} className="h-1.5" />
      <p className="text-[9px] text-muted-foreground">~{lifespan}d vida útil estimada</p>
    </div>
  );
}

function EditMetadataDialog({
  ad: adData,
  open,
  onClose,
  workspaceId,
  onSaved,
}: {
  ad: AdAggregate;
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  onSaved: () => void;
}) {
  const [format, setFormat] = useState(adData.format || '');
  const [hookType, setHookType] = useState(adData.hook_type || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const row = {
        workspace_id: workspaceId,
        ad_key: adData.ad_key,
        ad_name: adData.ad_name,
        campaign_key: adData.campaign_key,
        adset_key: null,
        format: format || null,
        hook_type: hookType || null,
        days_active: adData.days_active,
        peak_ctr: adData.peak_ctr,
        current_ctr: adData.current_ctr,
        degradation_pct: adData.degradation_pct,
        status: adData.status,
        updated_at: new Date().toISOString(),
      };

      if (adData.lifecycle_id) {
        await supabase.from('creative_lifecycle').update(row as any).eq('id', adData.lifecycle_id);
      } else {
        await supabase.from('creative_lifecycle').insert(row as any);
      }

      toast.success('Metadata salva');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-panel max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Editar Metadata</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground truncate">{adData.ad_name}</p>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Formato</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo de Hook</label>
            <Select value={hookType} onValueChange={setHookType}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {HOOK_OPTIONS.map(h => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="w-full text-xs gap-1">
            <Check className="h-3 w-3" /> {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const LIFESPAN_CHART_DATA = [
  { format: 'Vídeo', days: 14, fill: 'hsl(var(--chart-1))' },
  { format: 'Imagem', days: 21, fill: 'hsl(var(--chart-2))' },
  { format: 'Carrossel', days: 28, fill: 'hsl(var(--chart-3))' },
  { format: 'Stories', days: 10, fill: 'hsl(var(--chart-4))' },
];

type SortKey = 'ad_name' | 'ctr_link' | 'cpm' | 'lpv_rate' | 'cpa' | 'days_active' | 'status' | 'degradation_pct';

export default function CreativesView() {
  const { state } = useAppState();
  const { current } = useFilteredRecords();
  const { workspace } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState<'all' | CreativeStatus>('all');
  const [editingAd, setEditingAd] = useState<AdAggregate | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('degradation_pct');
  const [sortAsc, setSortAsc] = useState(false);
  const [lifecycleVersion, setLifecycleVersion] = useState(0);

  // Load lifecycle data from state (we'll use supabase directly for now)
  const [lifecycleData, setLifecycleData] = useState<CreativeLifecycleRecord[]>([]);
  
  // Load lifecycle on mount
  useState(() => {
    if (!workspace) return;
    supabase.from('creative_lifecycle').select('*').eq('workspace_id', workspace.id)
      .then(({ data }) => {
        if (data) setLifecycleData(data.map((r: any) => ({
          id: r.id,
          workspace_id: r.workspace_id,
          ad_key: r.ad_key,
          ad_name: r.ad_name,
          campaign_key: r.campaign_key,
          adset_key: r.adset_key,
          format: r.format,
          hook_type: r.hook_type,
          activated_at: r.activated_at,
          days_active: Number(r.days_active || 0),
          peak_ctr: Number(r.peak_ctr || 0),
          peak_ctr_date: r.peak_ctr_date,
          current_ctr: Number(r.current_ctr || 0),
          degradation_pct: Number(r.degradation_pct || 0),
          status: r.status || 'active',
        })));
      });
  });

  const lifecycleMap = useMemo(() => {
    const map = new Map<string, CreativeLifecycleRecord>();
    for (const lc of lifecycleData) map.set(lc.ad_key, lc);
    return map;
  }, [lifecycleData, lifecycleVersion]);

  const records = current.length > 0 ? current : state.records;
  const allAds = useMemo(() => aggregateAds(records, lifecycleMap), [records, lifecycleMap]);

  const filteredAds = useMemo(() => {
    let ads = statusFilter === 'all' ? allAds : allAds.filter(a => a.status === statusFilter);
    ads.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return ads;
  }, [allAds, statusFilter, sortKey, sortAsc]);

  const fatiguedCount = allAds.filter(a => a.status === 'fatigued' || a.degradation_pct > 25).length;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const reloadLifecycle = () => {
    if (!workspace) return;
    supabase.from('creative_lifecycle').select('*').eq('workspace_id', workspace.id)
      .then(({ data }) => {
        if (data) {
          setLifecycleData(data.map((r: any) => ({
            id: r.id, workspace_id: r.workspace_id, ad_key: r.ad_key, ad_name: r.ad_name,
            campaign_key: r.campaign_key, adset_key: r.adset_key, format: r.format,
            hook_type: r.hook_type, activated_at: r.activated_at,
            days_active: Number(r.days_active || 0), peak_ctr: Number(r.peak_ctr || 0),
            peak_ctr_date: r.peak_ctr_date, current_ctr: Number(r.current_ctr || 0),
            degradation_pct: Number(r.degradation_pct || 0), status: r.status || 'active',
          })));
          setLifecycleVersion(v => v + 1);
        }
      });
  };

  if (allAds.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4 max-w-md">
          <div className="h-20 w-20 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center glow-primary">
            <Palette className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Análise de Criativos</h2>
          <p className="text-sm text-muted-foreground">Sincronize dados do Meta Ads para analisar a performance e ciclo de vida dos seus criativos.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Criativos</h2>
          <p className="text-xs text-muted-foreground">{allAds.length} anúncios • Performance e ciclo de vida</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-7 w-32 text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos</SelectItem>
              <SelectItem value="fresh" className="text-xs">Fresh</SelectItem>
              <SelectItem value="peaking" className="text-xs">Peaking</SelectItem>
              <SelectItem value="declining" className="text-xs">Declining</SelectItem>
              <SelectItem value="fatigued" className="text-xs">Fatigued</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fatigued Alert */}
      {fatiguedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-3 border-destructive/30 flex items-center gap-3"
        >
          <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-destructive">
              {fatiguedCount} criativo{fatiguedCount > 1 ? 's' : ''} com fadiga ou degradação &gt; 25%
            </p>
            <p className="text-[10px] text-muted-foreground">Considere pausar e substituir para manter a performance.</p>
          </div>
        </motion.div>
      )}

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filteredAds.slice(0, 20).map((ad, i) => (
          <motion.div
            key={ad.ad_key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className={`glass-panel p-3 space-y-2 ${
              ad.status === 'fatigued' ? 'border-destructive/30' : ad.status === 'declining' ? 'border-warning/20' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate" title={ad.ad_name}>{ad.ad_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{ad.campaign_name || ad.campaign_key || '—'}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <StatusBadge status={ad.status} />
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingAd(ad)}>
                  <Edit2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[9px] text-muted-foreground">CTR Atual</p>
                <p className="text-xs font-mono font-bold text-foreground">{ad.current_ctr.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Peak CTR</p>
                <p className="text-xs font-mono text-foreground">{ad.peak_ctr.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground">Degrad.</p>
                <p className={`text-xs font-mono font-bold ${ad.degradation_pct > 25 ? 'text-destructive' : ad.degradation_pct > 15 ? 'text-warning' : 'text-positive'}`}>
                  {ad.degradation_pct.toFixed(0)}%
                </p>
              </div>
            </div>

            <LifecycleProgress daysActive={ad.days_active} format={ad.format} />

            {(ad.format || ad.hook_type) && (
              <div className="flex gap-1 flex-wrap">
                {ad.format && <Badge variant="secondary" className="text-[9px] h-4">{ad.format}</Badge>}
                {ad.hook_type && <Badge variant="secondary" className="text-[9px] h-4">{ad.hook_type}</Badge>}
              </div>
            )}
          </motion.div>
        ))}
      </div>
      {filteredAds.length > 20 && (
        <p className="text-[10px] text-muted-foreground text-center">Mostrando 20 de {filteredAds.length} criativos nos cards. Veja todos na tabela abaixo.</p>
      )}

      {/* Performance Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-3 border-b border-border/40">
          <h3 className="text-sm font-semibold text-foreground">Performance por Anúncio</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] cursor-pointer hover:text-foreground" onClick={() => handleSort('ad_name')}>Anúncio</TableHead>
                <TableHead className="text-[10px]">Campanha</TableHead>
                <TableHead className="text-[10px] text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('ctr_link')}>CTR</TableHead>
                <TableHead className="text-[10px] text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('cpm')}>CPM</TableHead>
                <TableHead className="text-[10px] text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('lpv_rate')}>LPV Rate</TableHead>
                <TableHead className="text-[10px] text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('cpa')}>CPA</TableHead>
                <TableHead className="text-[10px] text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('days_active')}>Dias</TableHead>
                <TableHead className="text-[10px] text-right cursor-pointer hover:text-foreground" onClick={() => handleSort('degradation_pct')}>Degrad.</TableHead>
                <TableHead className="text-[10px] cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAds.map(ad => (
                <TableRow
                  key={ad.ad_key}
                  className={
                    ad.status === 'fatigued' ? 'bg-destructive/5' :
                    ad.status === 'declining' ? 'bg-warning/5' : ''
                  }
                >
                  <TableCell className="text-xs font-medium max-w-[180px] truncate" title={ad.ad_name}>{ad.ad_name}</TableCell>
                  <TableCell className="text-[10px] text-muted-foreground max-w-[140px] truncate">{ad.campaign_name || '—'}</TableCell>
                  <TableCell className="text-xs font-mono text-right">{ad.ctr_link.toFixed(2)}%</TableCell>
                  <TableCell className="text-xs font-mono text-right">{brl(ad.cpm)}</TableCell>
                  <TableCell className="text-xs font-mono text-right">{pct(ad.lpv_rate)}</TableCell>
                  <TableCell className="text-xs font-mono text-right">{brl(ad.cpa)}</TableCell>
                  <TableCell className="text-xs font-mono text-right">{ad.days_active}d</TableCell>
                  <TableCell className={`text-xs font-mono text-right ${ad.degradation_pct > 25 ? 'text-destructive font-bold' : ad.degradation_pct > 15 ? 'text-warning' : ''}`}>
                    {ad.degradation_pct.toFixed(0)}%
                  </TableCell>
                  <TableCell><StatusBadge status={ad.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Lifespan Chart */}
      <div className="glass-panel p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Vida Útil Média por Formato</h3>
          <p className="text-[10px] text-muted-foreground">Médias iniciais — serão calibradas com seu histórico</p>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={LIFESPAN_CHART_DATA} layout="vertical" margin={{ left: 60, right: 20 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="format" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} axisLine={false} tickLine={false} width={55} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                formatter={(value: number) => [`${value} dias`, 'Vida útil']}
              />
              <Bar dataKey="days" radius={[0, 4, 4, 0]} barSize={20}>
                {LIFESPAN_CHART_DATA.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Edit Dialog */}
      {editingAd && workspace && (
        <EditMetadataDialog
          ad={editingAd}
          open={!!editingAd}
          onClose={() => setEditingAd(null)}
          workspaceId={workspace.id}
          onSaved={reloadLifecycle}
        />
      )}
    </div>
  );
}
