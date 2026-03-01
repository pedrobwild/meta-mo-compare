import { useMemo, useState, useEffect } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  computeDeltas,
  groupByLevel,
} from '@/lib/calculations';
import { generateInsights } from '@/lib/insights/rules';
import type { InsightCard } from '@/lib/insights/types';
import type { LeadQualityMetrics, CreativeLifecycleRecord } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Lightbulb, ArrowRight, Shield, Zap, Eye, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function safe(n: number, d: number) { return d > 0 ? n / d : 0; }

function buildLeadQualityMetrics(
  leadQuality: { campaign_key: string; leads_total: number; leads_atendidos: number; leads_qualificados: number; visitas_agendadas: number; contratos_fechados: number; receita_brl: number }[],
  spendByCampaign: Record<string, number>
): { aggregated: LeadQualityMetrics | null; byKey: Record<string, LeadQualityMetrics> } {
  if (leadQuality.length === 0) return { aggregated: null, byKey: {} };

  const byKey: Record<string, LeadQualityMetrics> = {};
  const totals = { leads_total: 0, leads_atendidos: 0, leads_qualificados: 0, visitas_agendadas: 0, contratos_fechados: 0, receita_brl: 0, spend: 0 };

  // Group by campaign
  const grouped: Record<string, typeof totals> = {};
  for (const lq of leadQuality) {
    const ck = lq.campaign_key;
    if (!grouped[ck]) grouped[ck] = { leads_total: 0, leads_atendidos: 0, leads_qualificados: 0, visitas_agendadas: 0, contratos_fechados: 0, receita_brl: 0, spend: 0 };
    grouped[ck].leads_total += lq.leads_total;
    grouped[ck].leads_atendidos += lq.leads_atendidos;
    grouped[ck].leads_qualificados += lq.leads_qualificados;
    grouped[ck].visitas_agendadas += lq.visitas_agendadas;
    grouped[ck].contratos_fechados += lq.contratos_fechados;
    grouped[ck].receita_brl += lq.receita_brl;
    grouped[ck].spend = spendByCampaign[ck] || 0;
  }

  for (const [ck, g] of Object.entries(grouped)) {
    const spend = g.spend;
    byKey[ck] = {
      campaign_key: ck,
      leads_total: g.leads_total,
      taxa_atendimento: safe(g.leads_atendidos, g.leads_total),
      taxa_qualificacao: safe(g.leads_qualificados, g.leads_total),
      taxa_agendamento: safe(g.visitas_agendadas, g.leads_total),
      taxa_fechamento: safe(g.contratos_fechados, g.leads_total),
      cpa_reuniao: safe(spend, g.visitas_agendadas),
      cpa_contrato: safe(spend, g.contratos_fechados),
      roas_real: safe(g.receita_brl, spend),
      receita_por_lead: safe(g.receita_brl, g.leads_total),
      receita_brl: g.receita_brl,
      contratos_fechados: g.contratos_fechados,
    };
    // Accumulate totals
    totals.leads_total += g.leads_total;
    totals.leads_atendidos += g.leads_atendidos;
    totals.leads_qualificados += g.leads_qualificados;
    totals.visitas_agendadas += g.visitas_agendadas;
    totals.contratos_fechados += g.contratos_fechados;
    totals.receita_brl += g.receita_brl;
    totals.spend += spend;
  }

  const aggregated: LeadQualityMetrics = {
    campaign_key: '__all__',
    leads_total: totals.leads_total,
    taxa_atendimento: safe(totals.leads_atendidos, totals.leads_total),
    taxa_qualificacao: safe(totals.leads_qualificados, totals.leads_total),
    taxa_agendamento: safe(totals.visitas_agendadas, totals.leads_total),
    taxa_fechamento: safe(totals.contratos_fechados, totals.leads_total),
    cpa_reuniao: safe(totals.spend, totals.visitas_agendadas),
    cpa_contrato: safe(totals.spend, totals.contratos_fechados),
    roas_real: safe(totals.receita_brl, totals.spend),
    receita_por_lead: safe(totals.receita_brl, totals.leads_total),
    receita_brl: totals.receita_brl,
    contratos_fechados: totals.contratos_fechados,
  };

  return { aggregated, byKey };
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  creative: <Lightbulb className="h-4 w-4" />,
  auction: <DollarSign className="h-4 w-4" />,
  post_click: <Eye className="h-4 w-4" />,
  efficiency: <Zap className="h-4 w-4" />,
  fatigue: <AlertTriangle className="h-4 w-4" />,
  budget: <Shield className="h-4 w-4" />,
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'text-negative',
  medium: 'text-warning',
  low: 'text-muted-foreground',
};

interface InsightCardsProps {
  onFilterTable?: (key: string, value: string) => void;
}

export default function InsightCards({ onFilterTable }: InsightCardsProps) {
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();

  // Fetch creative lifecycle data
  const [creatives, setCreatives] = useState<CreativeLifecycleRecord[]>([]);
  useEffect(() => {
    supabase.from('creative_lifecycle').select('*').then(({ data }) => {
      if (data) {
        setCreatives(data.map(d => ({
          id: d.id,
          workspace_id: d.workspace_id,
          ad_key: d.ad_key,
          ad_name: d.ad_name,
          campaign_key: d.campaign_key,
          adset_key: d.adset_key,
          format: d.format,
          hook_type: d.hook_type,
          activated_at: d.activated_at,
          days_active: d.days_active ?? 0,
          peak_ctr: Number(d.peak_ctr) || 0,
          peak_ctr_date: d.peak_ctr_date,
          current_ctr: Number(d.current_ctr) || 0,
          degradation_pct: Number(d.degradation_pct) || 0,
          status: d.status ?? 'active',
        })));
      }
    });
  }, []);

  const insights = useMemo(() => {
    if (current.length === 0) return [];

    const currentMetrics = aggregateMetrics(current);
    const previousMetrics = previous.length > 0 ? aggregateMetrics(previous) : null;
    const delta = computeDeltas(currentMetrics, previousMetrics);
    const rows = groupByLevel(current, previous, state.analysisLevel, '', false);

    // Build spend by campaign for lead quality metrics
    const spendByCampaign: Record<string, number> = {};
    for (const r of current) {
      if (r.campaign_key) {
        spendByCampaign[r.campaign_key] = (spendByCampaign[r.campaign_key] || 0) + r.spend_brl;
      }
    }

    const { aggregated, byKey } = buildLeadQualityMetrics(state.leadQuality, spendByCampaign);

    return generateInsights(currentMetrics, delta, rows, aggregated, byKey, creatives);
  }, [current, previous, state.analysisLevel, state.leadQuality, creatives]);

  if (insights.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        Insights ({insights.length})
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map(insight => (
          <div
            key={insight.id}
            className="border border-border rounded-lg p-3 space-y-2 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={SEVERITY_COLORS[insight.severity]}>
                  {CATEGORY_ICONS[insight.category] || <Zap className="h-4 w-4" />}
                </span>
                <h4 className="text-sm font-medium text-foreground">{insight.title}</h4>
              </div>
              <Badge variant={insight.severity === 'high' ? 'destructive' : 'secondary'} className="text-[10px] flex-shrink-0">
                {insight.confidence > 0.8 ? 'Alta' : insight.confidence > 0.5 ? 'Média' : 'Baixa'}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">{insight.description}</p>

            <div className="bg-secondary/50 rounded px-2 py-1">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Evidência:</span> {insight.evidence}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-primary">{insight.action}</p>
              {insight.affectedItems && insight.affectedItems.length > 0 && onFilterTable && (
                <button
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                  onClick={() => onFilterTable('search', insight.affectedItems![0])}
                >
                  Ver na tabela <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
