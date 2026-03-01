import { useState, useMemo, useRef } from 'react';
import { Upload, TrendingUp, Target, DollarSign, Users, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { useAppState } from '@/lib/store';
import { useWorkspace } from '@/lib/workspace';
import { saveLeadQualityBatch, loadLeadQuality } from '@/lib/persistence';
import type { LeadQualityRecord, LeadQualityMetrics } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const FUNNEL_STEPS = [
  { key: 'leads_total', label: 'Leads', color: 'hsl(var(--chart-1))' },
  { key: 'leads_atendidos', label: 'Atendidos', color: 'hsl(var(--chart-1) / 0.7)' },
  { key: 'leads_qualificados', label: 'Qualificados', color: 'hsl(var(--accent))' },
  { key: 'visitas_agendadas', label: 'Visitas', color: 'hsl(var(--chart-3))' },
  { key: 'propostas_enviadas', label: 'Propostas', color: 'hsl(var(--chart-4))' },
  { key: 'contratos_fechados', label: 'Contratos', color: 'hsl(var(--positive))' },
] as const;

function safe(n: number, d: number) { return d > 0 ? n / d : 0; }
function pct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function brl(v: number) { return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`; }

function roasColor(roas: number) {
  if (roas >= 3) return 'text-positive';
  if (roas >= 1.5) return 'text-warning';
  return 'text-destructive';
}

function computeMetrics(records: LeadQualityRecord[], spendByCampaign: Record<string, number>): LeadQualityMetrics[] {
  const grouped: Record<string, LeadQualityRecord[]> = {};
  for (const r of records) {
    (grouped[r.campaign_key] ??= []).push(r);
  }

  return Object.entries(grouped).map(([campaign_key, rows]) => {
    const leads_total = rows.reduce((s, r) => s + r.leads_total, 0);
    const leads_atendidos = rows.reduce((s, r) => s + r.leads_atendidos, 0);
    const leads_qualificados = rows.reduce((s, r) => s + r.leads_qualificados, 0);
    const visitas_agendadas = rows.reduce((s, r) => s + r.visitas_agendadas, 0);
    const contratos_fechados = rows.reduce((s, r) => s + r.contratos_fechados, 0);
    const receita_brl = rows.reduce((s, r) => s + r.receita_brl, 0);
    const spend = spendByCampaign[campaign_key] || 0;

    return {
      campaign_key,
      leads_total,
      taxa_atendimento: safe(leads_atendidos, leads_total),
      taxa_qualificacao: safe(leads_qualificados, leads_total),
      taxa_agendamento: safe(visitas_agendadas, leads_total),
      taxa_fechamento: safe(contratos_fechados, leads_total),
      cpa_reuniao: safe(spend, visitas_agendadas),
      cpa_contrato: safe(spend, contratos_fechados),
      roas_real: safe(receita_brl, spend),
      receita_por_lead: safe(receita_brl, leads_total),
      receita_brl,
      contratos_fechados,
    };
  }).sort((a, b) => b.roas_real - a.roas_real);
}

function FunnelBar({ record, maxLeads }: { record: LeadQualityRecord; maxLeads: number }) {
  return (
    <div className="space-y-1.5">
      {FUNNEL_STEPS.map((step) => {
        const val = record[step.key as keyof LeadQualityRecord] as number;
        const width = maxLeads > 0 ? Math.max((val / maxLeads) * 100, 2) : 2;
        const rate = step.key === 'leads_total' ? null : safe(val, record.leads_total);
        return (
          <div key={step.key} className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground w-20 text-right truncate">{step.label}</span>
            <div className="flex-1 h-5 bg-surface-2 rounded-sm overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-sm"
                style={{ background: step.color }}
              />
            </div>
            <span className="font-mono text-xs text-foreground w-12 text-right">{val}</span>
            {rate !== null && (
              <span className="font-mono text-[10px] text-muted-foreground w-14 text-right">{pct(rate)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, subtext, colorClass }: { label: string; value: string; subtext?: string; colorClass?: string }) {
  return (
    <div className="glass-panel p-3 space-y-1">
      <p className="metric-label">{label}</p>
      <p className={`metric-value text-lg ${colorClass || ''}`}>{value}</p>
      {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
    </div>
  );
}

export default function FunnelRealView() {
  const { state, dispatch } = useAppState();
  const { workspace } = useWorkspace();
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const leadQuality = state.leadQuality;

  // Compute spend by campaign from records
  const spendByCampaign = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of state.records) {
      if (r.campaign_key) {
        map[r.campaign_key] = (map[r.campaign_key] || 0) + r.spend_brl;
      }
    }
    return map;
  }, [state.records]);

  const metrics = useMemo(() => computeMetrics(leadQuality, spendByCampaign), [leadQuality, spendByCampaign]);

  // Totals
  const totals = useMemo(() => {
    if (metrics.length === 0) return null;
    const totalLeads = metrics.reduce((s, m) => s + m.leads_total, 0);
    const totalContratos = metrics.reduce((s, m) => s + m.contratos_fechados, 0);
    const totalReceita = metrics.reduce((s, m) => s + m.receita_brl, 0);
    const totalSpend = Object.values(spendByCampaign).reduce((s, v) => s + v, 0);
    return {
      leads: totalLeads,
      contratos: totalContratos,
      receita: totalReceita,
      roas: safe(totalReceita, totalSpend),
      cpaContrato: safe(totalSpend, totalContratos),
      receitaPerLead: safe(totalReceita, totalLeads),
      taxaFechamento: safe(totalContratos, totalLeads),
    };
  }, [metrics, spendByCampaign]);

  const maxLeads = useMemo(() => {
    return leadQuality.reduce((m, r) => Math.max(m, r.leads_total), 0);
  }, [leadQuality]);

  // Group by campaign for funnel bars
  const campaignGroups = useMemo(() => {
    const grouped: Record<string, LeadQualityRecord[]> = {};
    for (const r of leadQuality) {
      (grouped[r.campaign_key] ??= []).push(r);
    }
    // Aggregate per campaign
    return Object.entries(grouped).map(([key, rows]) => ({
      campaign_key: key,
      leads_total: rows.reduce((s, r) => s + r.leads_total, 0),
      leads_atendidos: rows.reduce((s, r) => s + r.leads_atendidos, 0),
      leads_qualificados: rows.reduce((s, r) => s + r.leads_qualificados, 0),
      visitas_agendadas: rows.reduce((s, r) => s + r.visitas_agendadas, 0),
      propostas_enviadas: rows.reduce((s, r) => s + r.propostas_enviadas, 0),
      contratos_fechados: rows.reduce((s, r) => s + r.contratos_fechados, 0),
      receita_brl: rows.reduce((s, r) => s + r.receita_brl, 0),
    } as LeadQualityRecord));
  }, [leadQuality]);

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workspace) return;
    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          const records: LeadQualityRecord[] = result.data.map((row: any) => ({
            id: crypto.randomUUID(),
            workspace_id: workspace.id,
            date: row.data || row.date || new Date().toISOString().slice(0, 10),
            campaign_key: row.campaign_key || 'unknown',
            adset_key: row.adset_key || null,
            ad_key: row.ad_key || null,
            leads_total: Number(row.leads_total) || 0,
            leads_atendidos: Number(row.leads_atendidos) || 0,
            leads_qualificados: Number(row.leads_qualificados) || 0,
            visitas_agendadas: Number(row.visitas_agendadas) || 0,
            propostas_enviadas: Number(row.propostas_enviadas) || 0,
            contratos_fechados: Number(row.contratos_fechados) || 0,
            receita_brl: Number(row.receita_brl) || 0,
            notes: row.notes || null,
          }));

          await saveLeadQualityBatch(records);
          const updated = await loadLeadQuality(workspace.id);
          dispatch({ type: 'SET_LEAD_QUALITY', data: updated });
          toast.success(`${records.length} registros importados`);
          setImportOpen(false);
        } catch (err: any) {
          toast.error(`Erro ao importar: ${err.message}`);
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

  // Empty state
  if (leadQuality.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-md mx-auto"
        >
          <div className="h-20 w-20 mx-auto rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center glow-accent">
            <Users className="h-10 w-10 text-accent" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Funil Real de Negócio</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Importe dados de qualidade de lead para ver o funil real de negócio.
              <br />
              <span className="text-foreground/60">O Meta mede cliques — este painel mede o que realmente importa.</span>
            </p>
          </div>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-medium glow-accent">
                <Upload className="h-4 w-4" /> Importar CSV de Qualidade
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel">
              <DialogHeader>
                <DialogTitle>Importar Qualidade de Lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-xs text-muted-foreground">
                  CSV com colunas: <span className="font-mono text-foreground/70">data, campaign_key, leads_total, leads_atendidos, leads_qualificados, visitas_agendadas, propostas_enviadas, contratos_fechados, receita_brl</span>
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
                {importing && <p className="text-xs text-primary animate-pulse">Importando...</p>}
              </div>
            </DialogContent>
          </Dialog>
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">
            Leads → Reuniões → Contratos → Receita
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Funil Real de Negócio</h2>
          <p className="text-xs text-muted-foreground">{leadQuality.length} registros • Meta → Lead → Contrato → Receita</p>
        </div>
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Upload className="h-3.5 w-3.5" /> Importar CSV
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel">
            <DialogHeader>
              <DialogTitle>Importar Qualidade de Lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                CSV com colunas: <span className="font-mono text-foreground/70">data, campaign_key, leads_total, leads_atendidos, leads_qualificados, visitas_agendadas, propostas_enviadas, contratos_fechados, receita_brl</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
              {importing && <p className="text-xs text-primary animate-pulse">Importando...</p>}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metric Cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard label="ROAS Real" value={totals.roas.toFixed(2) + 'x'} colorClass={roasColor(totals.roas)} />
          <MetricCard label="CPA Contrato" value={brl(totals.cpaContrato)} />
          <MetricCard label="Receita / Lead" value={brl(totals.receitaPerLead)} />
          <MetricCard label="Taxa Fechamento" value={pct(totals.taxaFechamento)} colorClass={totals.taxaFechamento > 0.05 ? 'text-positive' : 'text-muted-foreground'} />
          <MetricCard label="Receita Total" value={brl(totals.receita)} colorClass="text-positive" />
        </div>
      )}

      {/* Funnel by Campaign */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Funil por Campanha</h3>
        {campaignGroups.map((rec) => (
          <div key={rec.campaign_key} className="glass-panel p-4 space-y-3">
            <p className="text-xs font-medium text-foreground truncate">{rec.campaign_key}</p>
            <FunnelBar record={rec} maxLeads={maxLeads} />
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-3 border-b border-border/40">
          <h3 className="text-sm font-semibold text-foreground">Comparativo entre Campanhas</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Campanha</TableHead>
              <TableHead className="text-[10px] text-right">Leads</TableHead>
              <TableHead className="text-[10px] text-right">Taxa Atend.</TableHead>
              <TableHead className="text-[10px] text-right">Taxa Fecha.</TableHead>
              <TableHead className="text-[10px] text-right">CPA Contrato</TableHead>
              <TableHead className="text-[10px] text-right">ROAS Real</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m, i) => (
              <TableRow key={m.campaign_key} className={i === 0 ? 'bg-positive/5' : ''}>
                <TableCell className="text-xs font-medium truncate max-w-[200px]">
                  {i === 0 && <span className="inline-block mr-1.5 text-positive">★</span>}
                  {m.campaign_key}
                </TableCell>
                <TableCell className="text-xs font-mono text-right">{m.leads_total}</TableCell>
                <TableCell className="text-xs font-mono text-right">{pct(m.taxa_atendimento)}</TableCell>
                <TableCell className="text-xs font-mono text-right">{pct(m.taxa_fechamento)}</TableCell>
                <TableCell className="text-xs font-mono text-right">{brl(m.cpa_contrato)}</TableCell>
                <TableCell className={`text-xs font-mono text-right font-bold ${roasColor(m.roas_real)}`}>
                  {m.roas_real.toFixed(2)}x
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
