import { useAppState } from '@/lib/store';
import { getAvailablePeriods, getAvailableGranularities, getPeriodLabel } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { TruthSource, AnalysisLevel, PeriodGranularity } from '@/lib/types';

export default function GlobalFilters() {
  const { state, dispatch } = useAppState();
  const granularities = getAvailableGranularities(state.records);
  const periods = getAvailablePeriods(state.records, state.selectedGranularity);

  if (periods.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-4 glass-card p-4">
      {granularities.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Granularidade</Label>
          <Select value={state.selectedGranularity} onValueChange={g => dispatch({ type: 'SET_GRANULARITY', granularity: g as PeriodGranularity })}>
            <SelectTrigger className="w-[120px] bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semanal</SelectItem>
              <SelectItem value="day">Diário</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Período Atual</Label>
        <Select value={state.selectedPeriodKey || ''} onValueChange={p => dispatch({ type: 'SET_SELECTED_PERIOD', periodKey: p })}>
          <SelectTrigger className="w-[160px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map(p => <SelectItem key={p} value={p}>{getPeriodLabel(p, state.selectedGranularity)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Comparar com</Label>
        <Select value={state.comparisonPeriodKey || ''} onValueChange={p => dispatch({ type: 'SET_COMPARISON_PERIOD', periodKey: p })}>
          <SelectTrigger className="w-[160px] bg-secondary border-border">
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            {periods.map(p => <SelectItem key={p} value={p}>{getPeriodLabel(p, state.selectedGranularity)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Nível</Label>
        <Select value={state.analysisLevel} onValueChange={l => dispatch({ type: 'SET_ANALYSIS_LEVEL', level: l as AnalysisLevel })}>
          <SelectTrigger className="w-[140px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="campaign">Campanha</SelectItem>
            <SelectItem value="adset">Conjunto</SelectItem>
            <SelectItem value="ad">Anúncio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Fonte de Verdade</Label>
        <Select value={state.truthSource} onValueChange={s => dispatch({ type: 'SET_TRUTH_SOURCE', source: s as TruthSource })}>
          <SelectTrigger className="w-[160px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="type3_full">Full Hierarchy</SelectItem>
            <SelectItem value="type2_ad_campaign">Ad + Campanha</SelectItem>
            <SelectItem value="type1_ad_only">Ad Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 flex-1 min-w-[200px]">
        <Label className="text-xs text-muted-foreground">Buscar</Label>
        <Input
          placeholder="Filtrar por nome..."
          value={state.searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
          className="bg-secondary border-border"
        />
      </div>

      <div className="flex items-center gap-2 pb-1">
        <Switch
          checked={state.includeInactive}
          onCheckedChange={v => dispatch({ type: 'SET_INCLUDE_INACTIVE', value: v })}
        />
        <Label className="text-xs text-muted-foreground">Inativos</Label>
      </div>
    </div>
  );
}
