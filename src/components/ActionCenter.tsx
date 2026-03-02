import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/lib/workspace';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { supabase } from '@/integrations/supabase/client';
import { generateRecommendations } from '@/lib/alerts/engine';
import { aggregateInsights } from '@/lib/metrics/aggregate';
import { CheckCircle, XCircle, AlertTriangle, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ActionItem {
  id: string;
  title: string;
  why: string;
  what_to_do: string;
  priority: number;
  confidence: number;
  status: 'open' | 'done' | 'ignored';
  entity_level?: string;
  entity_id?: string;
}

export default function ActionCenter() {
  const { workspace } = useWorkspace();
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dbRecs, setDbRecs] = useState<any[]>([]);
  const [reasonInput, setReasonInput] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!workspace) return;
    supabase
      .from('recommendations')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('priority', { ascending: false })
      .then(({ data }) => setDbRecs(data || []));
  }, [workspace]);

  useEffect(() => {
    if (current.length === 0) return;

    const currentAgg = aggregateInsights(current.map(r => ({
      spend: r.spend_brl, impressions: r.impressions, reach: r.reach,
      clicks: r.clicks_all, inline_link_clicks: r.link_clicks,
      landing_page_views: r.landing_page_views, results_leads: r.results,
      purchases: 0, purchase_value: 0,
    })));

    const previousAgg = previous.length > 0 ? aggregateInsights(previous.map(r => ({
      spend: r.spend_brl, impressions: r.impressions, reach: r.reach,
      clicks: r.clicks_all, inline_link_clicks: r.link_clicks,
      landing_page_views: r.landing_page_views, results_leads: r.results,
      purchases: 0, purchase_value: 0,
    }))) : null;

    const recs = generateRecommendations(currentAgg, previousAgg);

    const merged: ActionItem[] = [
      ...dbRecs.map((r: any) => ({
        id: r.id,
        title: r.title,
        why: r.why || '',
        what_to_do: r.what_to_do || '',
        priority: r.priority,
        confidence: r.confidence || 0.5,
        status: r.status as 'open' | 'done' | 'ignored',
        entity_level: r.entity_level,
        entity_id: r.entity_id,
      })),
      ...recs.map((r, i) => ({
        id: `auto-${i}`,
        title: r.title,
        why: r.why,
        what_to_do: r.what_to_do,
        priority: r.priority,
        confidence: r.confidence,
        status: 'open' as const,
      })),
    ];

    setActions(merged);
  }, [current, previous, dbRecs]);

  const logDecisionToDb = async (action: ActionItem, status: 'done' | 'ignored') => {
    if (!workspace) return;
    const periodKey = state.dateFrom && state.dateTo
      ? `${state.dateFrom}_${state.dateTo}`
      : new Date().toISOString().slice(0, 10);

    const { data: { user } } = await supabase.auth.getUser();

    // Legacy decisions_log
    await supabase.from('decisions_log').insert({
      workspace_id: workspace.id,
      period_key: periodKey,
      item_key: action.entity_id || action.id,
      item_name: action.title,
      action_type: status === 'done' ? 'scale' : 'pause',
      reason: action.why,
      expected_result: action.what_to_do,
      user_id: user?.id || null,
      notes: reasonInput[action.id] || null,
    } as any);

    // Also log to optimization_log for the new Decisions module
    await supabase.from('optimization_log').insert({
      workspace_id: workspace.id,
      created_by: user?.id || null,
      decision_type: status === 'done' ? 'escalar' : 'pausar',
      entity_type: action.entity_level || 'campaign',
      entity_id: action.entity_id || action.id,
      entity_name: action.title,
      reason: action.why,
      action_taken: action.what_to_do,
      expected_impact: action.what_to_do,
      status: 'monitoring',
      tags: ['action-center'],
      notes: reasonInput[action.id] || null,
      action_center_id: action.id.startsWith('auto-') ? null : action.id,
    } as any);
  };

  const handleAction = async (id: string, status: 'done' | 'ignored') => {
    const action = actions.find(a => a.id === id);
    if (!action) return;

    setActions(prev => prev.map(a => a.id === id ? { ...a, status } : a));

    // Always log to decisions_log
    await logDecisionToDb(action, status);

    if (!id.startsWith('auto-') && workspace) {
      await supabase.from('recommendations').update({ status }).eq('id', id);
    }

    toast.success(`Decisão registrada: ${status === 'done' ? 'Executada' : 'Ignorada'}`);
  };

  const openActions = actions.filter(a => a.status === 'open');
  const closedActions = actions.filter(a => a.status !== 'open');

  const getSeverityColor = (priority: number) => {
    if (priority >= 80) return 'text-destructive border-destructive/30 bg-destructive/10';
    if (priority >= 60) return 'text-warning border-warning/30 bg-warning/10';
    return 'text-primary border-primary/30 bg-primary/10';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" strokeWidth={1.5} />
           Action Center
          {openActions.length > 0 && (
             <Badge variant="secondary" className="bg-primary/10 text-primary text-meta-caption">
              {openActions.length} ações
            </Badge>
          )}
        </h2>
      </div>

      {openActions.length === 0 && (
        <Card className="bg-card border border-border rounded-meta-card shadow-meta-subtle">
          <CardContent className="py-8 text-center text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-positive" strokeWidth={1.5} />
            <p className="text-meta-body">Nenhuma ação pendente — performance dentro do esperado.</p>
          </CardContent>
        </Card>
      )}

      <AnimatePresence>
        {openActions.map(action => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className={`bg-card border rounded-meta-card shadow-meta-subtle ${getSeverityColor(action.priority)} cursor-pointer`}
              onClick={() => setExpanded(expanded === action.id ? null : action.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
                      <span className="font-medium text-meta-body">{action.title}</span>
                      <Badge variant="outline" className="text-meta-label px-1.5 py-0">
                        {Math.round(action.confidence * 100)}%
                      </Badge>
                    </div>
                    
                    <AnimatePresence>
                      {expanded === action.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 space-y-3 text-sm"
                        >
                          <div>
                            <span className="text-muted-foreground font-medium">Por quê:</span>
                            <p className="text-foreground/80 mt-0.5">{action.why}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground font-medium">O que fazer:</span>
                            <p className="text-foreground/80 mt-0.5">{action.what_to_do}</p>
                          </div>
                          <div>
                            <Textarea
                              placeholder="Justificativa / notas (opcional)..."
                              className="text-xs h-16 bg-background/50"
                              value={reasonInput[action.id] || ''}
                              onChange={e => {
                                e.stopPropagation();
                                setReasonInput(prev => ({ ...prev, [action.id]: e.target.value }));
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                             <Button size="sm" variant="outline" className="text-positive border-positive/30 hover:bg-positive/10"
                              onClick={e => { e.stopPropagation(); handleAction(action.id, 'done'); }}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} /> Executar
                            </Button>
                            <Button size="sm" variant="outline" className="text-muted-foreground hover:bg-secondary"
                              onClick={e => { e.stopPropagation(); handleAction(action.id, 'ignored'); }}>
                              <XCircle className="h-3.5 w-3.5 mr-1" strokeWidth={1.5} /> Ignorar
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {expanded === action.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>

      {closedActions.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">{closedActions.length} ação(ões) concluída(s)/ignorada(s)</summary>
          <div className="mt-2 space-y-1">
            {closedActions.map(a => (
              <div key={a.id} className="flex items-center gap-2 opacity-50">
              {a.status === 'done' ? <CheckCircle className="h-3 w-3 text-positive" strokeWidth={1.5} /> : <XCircle className="h-3 w-3" strokeWidth={1.5} />}
                <span>{a.title}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
