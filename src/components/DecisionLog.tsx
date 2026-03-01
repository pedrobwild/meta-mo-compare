import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppState } from '@/lib/store';
import { groupByLevel, filterByPeriodWithFallback, aggregateMetrics } from '@/lib/calculations';
import { computeVerdict } from '@/lib/insights/verdicts';
import { History, Plus, Check, ArrowUp, Pause, RefreshCw, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/calculations';

interface DecisionEntry {
  id: string;
  period_key: string;
  item_name: string;
  item_key: string;
  action_type: string;
  reason: string | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  scale: <ArrowUp className="h-3.5 w-3.5" />,
  pause: <Pause className="h-3.5 w-3.5" />,
  test: <RefreshCw className="h-3.5 w-3.5" />,
  watch: <Eye className="h-3.5 w-3.5" />,
};

const ACTION_LABELS: Record<string, string> = {
  scale: 'Escalou',
  pause: 'Pausou',
  test: 'Testou variação',
  watch: 'Observou',
};

export default function DecisionLog() {
  const { state } = useAppState();
  const [entries, setEntries] = useState<DecisionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    const { data, error } = await supabase
      .from('decisions_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setEntries(data as DecisionEntry[]);
    setLoading(false);
  }

  async function logDecision(itemKey: string, itemName: string, actionType: string, reason?: string) {
    if (!state.selectedPeriodKey) return;
    const { error } = await supabase.from('decisions_log').insert({
      period_key: state.selectedPeriodKey,
      item_key: itemKey,
      item_name: itemName,
      action_type: actionType,
      reason: reason || null,
    } as any);
    if (!error) loadEntries();
  }

  async function deleteEntry(id: string) {
    await supabase.from('decisions_log').delete().eq('id', id);
    loadEntries();
  }

  // Quick actions from current verdicts
  const quickActions = (() => {
    if (!state.selectedPeriodKey) return [];
    const current = filterByPeriodWithFallback(state.records, state.selectedPeriodKey, state.truthSource);
    const previous = state.comparisonPeriodKey
      ? filterByPeriodWithFallback(state.records, state.comparisonPeriodKey, state.truthSource)
      : [];
    const avgMetrics = aggregateMetrics(current);
    const rows = groupByLevel(current, previous, state.analysisLevel, '', false);

    return rows.map(row => {
      const v = computeVerdict(row, avgMetrics);
      const actionMap: Record<string, string> = { scale: 'scale', pause: 'pause', test_variation: 'test', watch: 'watch', keep: 'watch' };
      return {
        key: row.key,
        name: row.name,
        action: actionMap[v.verdict] || 'watch',
        verdict: v,
        spend: row.metrics.spend_brl,
        alreadyLogged: entries.some(e => e.item_key === row.key && e.period_key === state.selectedPeriodKey),
      };
    });
  })();

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        Histórico de Decisões
      </h3>

      {/* Quick log from verdicts */}
      {quickActions.length > 0 && (
        <div className="mb-4 space-y-1.5">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Registrar decisão</p>
          {quickActions.map(qa => (
            <div key={qa.key} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30">
              <span className={qa.verdict.color}>{ACTION_ICONS[qa.action]}</span>
              <span className="text-xs text-foreground flex-1 truncate">{qa.name}</span>
              <span className="text-[11px] text-muted-foreground">{formatCurrency(qa.spend)}</span>
              {qa.alreadyLogged ? (
                <Check className="h-3.5 w-3.5 text-positive" />
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => logDecision(qa.key, qa.name, qa.action, qa.verdict.reasons[0])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Log
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History */}
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Histórico recente</p>
        {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!loading && entries.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma decisão registrada ainda.</p>
        )}
        {entries.slice(0, 15).map(entry => (
          <div key={entry.id} className="flex items-start gap-2 p-2 rounded-md bg-secondary/20 group">
            <span className="text-muted-foreground mt-0.5">{ACTION_ICONS[entry.action_type] || <Eye className="h-3.5 w-3.5" />}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground">
                <span className="font-medium">{ACTION_LABELS[entry.action_type] || entry.action_type}</span>
                {' '}<span className="text-foreground/80">{entry.item_name}</span>
              </p>
              {entry.reason && <p className="text-[11px] text-muted-foreground truncate">{entry.reason}</p>}
              <p className="text-[10px] text-muted-foreground">{entry.period_key} • {new Date(entry.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <button
              onClick={() => deleteEntry(entry.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-negative transition-opacity"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
