import { useAppState } from '@/lib/store';
import { getAvailableMonths, getMonthLabel } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { TruthSource, AnalysisLevel } from '@/lib/types';

export default function GlobalFilters() {
  const { state, dispatch } = useAppState();
  const months = getAvailableMonths(state.records);

  if (months.length === 0) return null;

  return (
    <div className="flex flex-wrap items-end gap-4 glass-card p-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Mês Atual</Label>
        <Select value={state.selectedMonth || ''} onValueChange={m => dispatch({ type: 'SET_SELECTED_MONTH', month: m })}>
          <SelectTrigger className="w-[140px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Comparar com</Label>
        <Select value={state.comparisonMonth || ''} onValueChange={m => dispatch({ type: 'SET_COMPARISON_MONTH', month: m })}>
          <SelectTrigger className="w-[140px] bg-secondary border-border">
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>)}
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
