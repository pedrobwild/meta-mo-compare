import { useState, useCallback } from 'react';
import { Sparkles, Loader2, AlertTriangle, TrendingUp, Target, Palette, Users, DollarSign, Layout, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { aggregateMetrics, computeDeltas, identifyDrivers } from '@/lib/calculations';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Recommendation {
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  why: string;
  what_to_do: string;
  expected_impact: string;
  confidence: number;
}

const CATEGORY_ICONS: Record<string, any> = {
  criativo: Palette,
  público: Users,
  orçamento: DollarSign,
  landing_page: Layout,
  funil: TrendingUp,
  posicionamento: Target,
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};

export default function AIRecommendationsPanel() {
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  const generate = useCallback(async () => {
    if (current.length === 0) {
      toast.error('Carregue dados antes de gerar recomendações');
      return;
    }

    setLoading(true);
    try {
      const metrics = aggregateMetrics(current);
      const prev = previous.length > 0 ? aggregateMetrics(previous) : null;
      const delta = prev ? computeDeltas(metrics, prev) : null;
      const drivers = delta ? identifyDrivers(delta, 5) : [];

      const { data, error } = await supabase.functions.invoke('ai-recommendations', {
        body: {
          metrics: {
            spend: metrics.spend_brl,
            impressions: metrics.impressions,
            clicks: metrics.link_clicks,
            results: metrics.results,
            cpm: metrics.cpm,
            cpc: metrics.cpc_link,
            ctr: metrics.ctr_link,
            cpa: metrics.cost_per_result,
            frequency: metrics.frequency,
            lpv_rate: metrics.lpv_rate,
            reach: metrics.reach,
          },
          drivers: drivers.map(d => ({
            metric: d.label,
            change: `${d.percentChange > 0 ? '+' : ''}${d.percentChange.toFixed(1)}%`,
            impact: d.impact,
          })),
        },
      });

      if (error) throw error;

      if (data?.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
        toast.success(`${data.recommendations.length} recomendações geradas`);
      } else {
        toast.info('Nenhuma recomendação gerada. Tente com mais dados.');
      }
    } catch (e: any) {
      console.error('AI recommendations error:', e);
      toast.error(e.message || 'Erro ao gerar recomendações');
    }
    setLoading(false);
  }, [current, previous]);

  return (
    <Card className="bg-card border border-border rounded-meta-card shadow-meta-subtle">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-meta-body font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} />
            Recomendações IA
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={generate}
            disabled={loading || current.length === 0}
            className="h-7 text-meta-caption gap-1.5"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" strokeWidth={1.5} />}
            {loading ? 'Analisando...' : 'Gerar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {recommendations.length === 0 && !loading && (
          <p className="text-meta-caption text-muted-foreground text-center py-4">
            Clique em "Gerar" para receber recomendações de IA baseadas nos dados atuais
          </p>
        )}

        {loading && recommendations.length === 0 && (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-meta-caption text-muted-foreground">Analisando métricas...</span>
          </div>
        )}

        {recommendations.map((rec, i) => {
          const Icon = CATEGORY_ICONS[rec.category] || AlertTriangle;
          const isExpanded = expanded === i;

          return (
            <div
              key={i}
              className="border border-border rounded-meta-btn p-3 space-y-2 hover:bg-secondary/30 transition-colors cursor-pointer"
              onClick={() => setExpanded(isExpanded ? null : i)}
            >
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-foreground">{rec.title}</span>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${PRIORITY_COLORS[rec.priority]}`}>
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{rec.why}</p>
                </div>
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>

              {isExpanded && (
                <div className="pl-6 space-y-2 pt-1 border-t border-border/50">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">O que fazer</p>
                    <p className="text-xs text-foreground">{rec.what_to_do}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Impacto esperado</p>
                    <p className="text-xs text-foreground">{rec.expected_impact}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[9px]">
                      {rec.category}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">
                      Confiança: {Math.round(rec.confidence * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
