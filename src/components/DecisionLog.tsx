import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppState } from '@/lib/store';
import { useWorkspace } from '@/lib/workspace';
import { groupByLevel, filterByPeriodWithFallback, aggregateMetrics, formatCurrency } from '@/lib/calculations';
import { computeVerdict } from '@/lib/insights/verdicts';
import { History, Plus, Check, ArrowUp, Pause, RefreshCw, Eye, Trash2, StickyNote, Filter, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface DecisionEntry {
  id: string;
  period_key: string;
  item_name: string;
  item_key: string;
  action_type: string;
  reason: string | null;
  expected_result: string | null;
  notes: string | null;
  user_id: string | null;
  workspace_id: string | null;
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

const ACTION_COLORS: Record<string, string> = {
  scale: 'text-emerald-400',
  pause: 'text-red-400',
  test: 'text-amber-400',
  watch: 'text-blue-400',
};

export default function DecisionLog() {
  const { state } = useAppState();
  const { workspace } = useWorkspace();
  const [entries, setEntries] = useState<DecisionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  // Filters
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadEntries();
  }, [workspace]);

  async function loadEntries() {
    let query = supabase
      .from('decisions_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (workspace) {
      query = query.eq('workspace_id', workspace.id);
    }

    const { data, error } = await query;
    if (!error && data) setEntries(data as DecisionEntry[]);
    setLoading(false);
  }

  async function logDecision(itemKey: string, itemName: string, actionType: string, reason?: string) {
    const periodKey = state.dateFrom && state.dateTo
      ? `${state.dateFrom}_${state.dateTo}`
      : state.selectedPeriodKey || new Date().toISOString().slice(0, 10);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('decisions_log').insert({
      period_key: periodKey,
      item_key: itemKey,
      item_name: itemName,
      action_type: actionType,
      reason: reason || null,
      user_id: user?.id || null,
      workspace_id: workspace?.id || null,
    } as any);
    if (!error) {
      loadEntries();
      toast.success('Decisão registrada');
    }
  }

  async function deleteEntry(id: string) {
    await supabase.from('decisions_log').delete().eq('id', id);
    loadEntries();
    toast.success('Decisão removida');
  }

  async function saveNote(id: string) {
    const { error } = await supabase
      .from('decisions_log')
      .update({ notes: noteText } as any)
      .eq('id', id);
    if (!error) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, notes: noteText } : e));
      setEditingNote(null);
      toast.success('Nota salva');
    }
  }

  // Unique campaigns/items for filter
  const uniqueCampaigns = useMemo(() => {
    const names = [...new Set(entries.map(e => e.item_name))];
    return names.sort();
  }, [entries]);

  const uniqueActions = useMemo(() => {
    return [...new Set(entries.map(e => e.action_type))];
  }, [entries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filterCampaign !== 'all' && e.item_name !== filterCampaign) return false;
      if (filterAction !== 'all' && e.action_type !== filterAction) return false;
      if (searchText && !e.item_name.toLowerCase().includes(searchText.toLowerCase()) &&
          !(e.reason || '').toLowerCase().includes(searchText.toLowerCase()) &&
          !(e.notes || '').toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [entries, filterCampaign, filterAction, searchText]);

  const hasFilters = filterCampaign !== 'all' || filterAction !== 'all' || searchText !== '';

  // Quick actions from current verdicts
  const quickActions = (() => {
    if (!state.dateFrom || !state.dateTo) return [];
    const current = state.records.filter(r => {
      const d = r.period_start;
      return d >= state.dateFrom! && d <= state.dateTo!;
    });
    if (current.length === 0) return [];
    const previous = state.comparisonFrom && state.comparisonTo
      ? state.records.filter(r => r.period_start >= state.comparisonFrom! && r.period_start <= state.comparisonTo!)
      : [];
    const avgMetrics = aggregateMetrics(current);
    const rows = groupByLevel(current, previous, state.analysisLevel, '', false);

    const periodKey = `${state.dateFrom}_${state.dateTo}`;
    return rows.slice(0, 10).map(row => {
      const v = computeVerdict(row, avgMetrics);
      const actionMap: Record<string, string> = { scale: 'scale', pause: 'pause', test_variation: 'test', watch: 'watch', keep: 'watch' };
      return {
        key: row.key,
        name: row.name,
        action: actionMap[v.verdict] || 'watch',
        verdict: v,
        spend: row.metrics.spend_brl,
        alreadyLogged: entries.some(e => e.item_key === row.key && e.period_key === periodKey),
      };
    });
  })();

  return (
    <div className="glass-card p-5 space-y-5">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        Histórico de Decisões
        {entries.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">{entries.length}</Badge>
        )}
      </h3>

      {/* Quick log from verdicts */}
      {quickActions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Registrar decisão</p>
          {quickActions.map(qa => (
            <div key={qa.key} className="flex items-center gap-2 p-2 rounded-md bg-secondary/30">
              <span className={ACTION_COLORS[qa.action] || 'text-muted-foreground'}>{ACTION_ICONS[qa.action]}</span>
              <span className="text-xs text-foreground flex-1 truncate">{qa.name}</span>
              <span className="text-[11px] text-muted-foreground">{formatCurrency(qa.spend)}</span>
              {qa.alreadyLogged ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
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

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Filtros</p>
          {hasFilters && (
            <Button size="sm" variant="ghost" className="h-5 px-1 text-[10px] text-muted-foreground"
              onClick={() => { setFilterCampaign('all'); setFilterAction('all'); setSearchText(''); }}>
              <X className="h-3 w-3 mr-0.5" /> Limpar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tipo de ação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {uniqueActions.map(a => (
                <SelectItem key={a} value={a}>{ACTION_LABELS[a] || a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCampaign} onValueChange={setFilterCampaign}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {uniqueCampaigns.map(c => (
                <SelectItem key={c} value={c}>{c.length > 30 ? c.slice(0, 30) + '…' : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Buscar..."
            className="h-8 text-xs"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </div>
      </div>

      {/* History */}
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
          Histórico {hasFilters ? `(${filteredEntries.length} de ${entries.length})` : `(${entries.length})`}
        </p>
        {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!loading && filteredEntries.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {hasFilters ? 'Nenhuma decisão encontrada com esses filtros.' : 'Nenhuma decisão registrada ainda.'}
          </p>
        )}
        {filteredEntries.map(entry => (
          <div key={entry.id} className="p-3 rounded-md bg-secondary/20 group space-y-2">
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 ${ACTION_COLORS[entry.action_type] || 'text-muted-foreground'}`}>
                {ACTION_ICONS[entry.action_type] || <Eye className="h-3.5 w-3.5" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground">
                  <span className="font-medium">{ACTION_LABELS[entry.action_type] || entry.action_type}</span>
                  {' '}<span className="text-foreground/80">{entry.item_name}</span>
                </p>
                {entry.reason && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground/60">Motivo:</span> {entry.reason}
                  </p>
                )}
                {entry.expected_result && (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/60">Resultado esperado:</span> {entry.expected_result}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {entry.period_key} • {new Date(entry.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setEditingNote(editingNote === entry.id ? null : entry.id);
                    setNoteText(entry.notes || '');
                  }}
                  className="text-muted-foreground hover:text-primary"
                  title="Adicionar nota"
                >
                  <StickyNote className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Remover"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Notes display */}
            {entry.notes && editingNote !== entry.id && (
              <div className="ml-6 p-2 rounded bg-muted/20 border border-border/20">
                <p className="text-[11px] text-foreground/80">
                  <StickyNote className="h-3 w-3 inline mr-1 text-amber-400" />
                  {entry.notes}
                </p>
              </div>
            )}

            {/* Notes editor */}
            {editingNote === entry.id && (
              <div className="ml-6 space-y-2">
                <Textarea
                  placeholder="Adicionar nota sobre esta decisão..."
                  className="text-xs h-16 bg-background/50"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                    onClick={() => saveNote(entry.id)}>
                    <Save className="h-3 w-3 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                    onClick={() => setEditingNote(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
