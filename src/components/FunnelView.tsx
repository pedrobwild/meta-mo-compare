import { useState } from 'react';
import { useAppState } from '@/lib/store';
import { formatCurrency, formatNumber, formatPercent, computeFunnel, aggregateMetrics, filterByTruthSourceWithFallback, getMonthLabel } from '@/lib/calculations';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { FunnelData } from '@/lib/types';
import { Save, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function FunnelView() {
  const { state, dispatch } = useAppState();
  const month = state.selectedMonth;
  const compMonth = state.comparisonMonth;

  const existing = state.funnelData.find(f => f.month_key === month);
  const [form, setForm] = useState<FunnelData>({
    month_key: month || '',
    mql: existing?.mql ?? 0,
    sql: existing?.sql ?? 0,
    vendas: existing?.vendas ?? 0,
    receita: existing?.receita ?? 0,
  });

  if (!month) return <p className="text-muted-foreground text-center py-8">Selecione um mês</p>;

  const metrics = aggregateMetrics(filterByTruthSourceWithFallback(state.records, month, state.truthSource));
  const funnel = computeFunnel(existing || form, metrics);

  const prevFunnel = compMonth ? state.funnelData.find(f => f.month_key === compMonth) : null;
  const prevMetrics = compMonth ? aggregateMetrics(filterByTruthSourceWithFallback(state.records, compMonth, state.truthSource)) : null;
  const prevComputed = prevFunnel && prevMetrics ? computeFunnel(prevFunnel, prevMetrics) : null;

  const save = () => {
    dispatch({ type: 'SET_FUNNEL', funnel: { ...form, month_key: month } });
    toast.success('Dados do funil salvos');
  };

  const stages = funnel ? [
    { label: 'Cliques', value: metrics.link_clicks, prev: prevMetrics?.link_clicks },
    { label: 'MQL', value: funnel.mql, prev: prevComputed?.mql, rate: funnel.click_to_mql, prevRate: prevComputed?.click_to_mql, rateLabel: 'Click→MQL' },
    { label: 'SQL', value: funnel.sql, prev: prevComputed?.sql, rate: funnel.mql_to_sql, prevRate: prevComputed?.mql_to_sql, rateLabel: 'MQL→SQL' },
    { label: 'Vendas', value: funnel.vendas, prev: prevComputed?.vendas, rate: funnel.sql_to_vendas, prevRate: prevComputed?.sql_to_vendas, rateLabel: 'SQL→Vendas' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Input form */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Dados Manuais — {getMonthLabel(month)}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['mql', 'sql', 'vendas', 'receita'] as const).map(field => (
            <div key={field} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase">{field === 'receita' ? 'Receita (R$)' : field.toUpperCase()}</Label>
              <Input
                type="number"
                value={form[field] || ''}
                onChange={e => setForm(prev => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
                className="bg-secondary border-border"
              />
            </div>
          ))}
        </div>
        <Button onClick={save} className="mt-4" size="sm">
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
      </div>

      {/* Funnel visualization */}
      {funnel && (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {stages.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="glass-card p-4 min-w-[120px] text-center">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold text-foreground">{formatNumber(s.value)}</p>
                  {s.prev !== undefined && s.prev > 0 && (
                    <p className="text-xs text-muted-foreground">ant: {formatNumber(s.prev)}</p>
                  )}
                </div>
                {i < stages.length - 1 && (
                  <div className="flex flex-col items-center min-w-[60px]">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    {s.rate !== undefined && (
                      <p className="text-xs text-primary font-medium">{formatPercent(s.rate * 100, 1)}</p>
                    )}
                    {s.rateLabel && <p className="text-[10px] text-muted-foreground">{s.rateLabel}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ticket Médio', value: formatCurrency(funnel.ticket_medio) },
              { label: 'CAC (Mídia)', value: formatCurrency(funnel.cac_midia) },
              { label: 'ROAS', value: funnel.roas.toFixed(2) + 'x' },
              { label: 'Receita', value: formatCurrency(funnel.receita) },
            ].map(kpi => (
              <div key={kpi.label} className="glass-card p-4 text-center">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold text-foreground">{kpi.value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
