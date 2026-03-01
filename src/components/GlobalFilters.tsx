import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ArrowRightLeft } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { getDateBounds, getDateRangeLabel } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TruthSource, AnalysisLevel } from '@/lib/types';
import type { DateRange } from 'react-day-picker';

const PRESETS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '30 dias', days: 30 },
] as const;

export default function GlobalFilters() {
  const { state, dispatch } = useAppState();
  const bounds = getDateBounds(state.records);

  const [mainOpen, setMainOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);

  if (!bounds) return null;

  const mainFrom = state.dateFrom ? new Date(state.dateFrom + 'T00:00:00') : undefined;
  const mainTo = state.dateTo ? new Date(state.dateTo + 'T00:00:00') : undefined;
  const compFrom = state.comparisonFrom ? new Date(state.comparisonFrom + 'T00:00:00') : undefined;
  const compTo = state.comparisonTo ? new Date(state.comparisonTo + 'T00:00:00') : undefined;

  const handleMainSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      const from = format(range.from, 'yyyy-MM-dd');
      const to = format(range.to, 'yyyy-MM-dd');
      dispatch({ type: 'SET_DATE_RANGE', from, to });
      setMainOpen(false);
    } else if (range?.from) {
      // Single day selected, wait for second click
    }
  };

  const handleCompSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      dispatch({ type: 'SET_COMPARISON_RANGE', from: format(range.from, 'yyyy-MM-dd'), to: format(range.to, 'yyyy-MM-dd') });
      setCompOpen(false);
    }
  };

  const applyPreset = (days: number) => {
    const maxDate = new Date(bounds.max + 'T00:00:00');
    const to = format(maxDate, 'yyyy-MM-dd');
    const from = format(subDays(maxDate, days - 1), 'yyyy-MM-dd');
    dispatch({ type: 'SET_DATE_RANGE', from, to });
  };

  const applyMonthPreset = (offset: number) => {
    const ref = offset === 0 ? new Date() : subMonths(new Date(), 1);
    const from = format(startOfMonth(ref), 'yyyy-MM-dd');
    const to = format(endOfMonth(ref), 'yyyy-MM-dd');
    dispatch({ type: 'SET_DATE_RANGE', from, to });
  };

  const mainLabel = state.dateFrom && state.dateTo
    ? getDateRangeLabel(state.dateFrom, state.dateTo)
    : 'Selecionar período';

  const compLabel = state.comparisonFrom && state.comparisonTo
    ? getDateRangeLabel(state.comparisonFrom, state.comparisonTo)
    : 'Nenhum';

  return (
    <div className="flex flex-wrap items-end gap-3 glass-card p-4">
      {/* Date Range Picker */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Período</Label>
        <Popover open={mainOpen} onOpenChange={setMainOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[220px] justify-start text-left font-normal bg-secondary border-border',
                !state.dateFrom && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {mainLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-wrap gap-1 p-3 pb-0 border-b border-border">
              {PRESETS.map(p => (
                <Button
                  key={p.days}
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => { applyPreset(p.days); setMainOpen(false); }}
                >
                  {p.label}
                </Button>
              ))}
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { applyMonthPreset(0); setMainOpen(false); }}>
                Este mês
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { applyMonthPreset(-1); setMainOpen(false); }}>
                Mês passado
              </Button>
            </div>
            <Calendar
              mode="range"
              selected={{ from: mainFrom, to: mainTo }}
              onSelect={handleMainSelect}
              numberOfMonths={2}
              className={cn('p-3 pointer-events-auto')}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Comparison Range */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <ArrowRightLeft className="h-3 w-3" /> Comparar com
        </Label>
        <Popover open={compOpen} onOpenChange={setCompOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[220px] justify-start text-left font-normal bg-secondary border-border',
                !state.comparisonFrom && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {compLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: compFrom, to: compTo }}
              onSelect={handleCompSelect}
              numberOfMonths={2}
              className={cn('p-3 pointer-events-auto')}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Analysis Level */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Nível</Label>
        <Select value={state.analysisLevel} onValueChange={l => dispatch({ type: 'SET_ANALYSIS_LEVEL', level: l as AnalysisLevel })}>
          <SelectTrigger className="w-[130px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="campaign">Campanha</SelectItem>
            <SelectItem value="adset">Conjunto</SelectItem>
            <SelectItem value="ad">Anúncio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Truth Source */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Fonte</Label>
        <Select value={state.truthSource} onValueChange={s => dispatch({ type: 'SET_TRUTH_SOURCE', source: s as TruthSource })}>
          <SelectTrigger className="w-[140px] bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="type3_full">Full Hierarchy</SelectItem>
            <SelectItem value="type2_ad_campaign">Ad + Campanha</SelectItem>
            <SelectItem value="type1_ad_only">Ad Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="space-y-1.5 flex-1 min-w-[180px]">
        <Label className="text-xs text-muted-foreground">Buscar</Label>
        <Input
          placeholder="Filtrar por nome..."
          value={state.searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
          className="bg-secondary border-border"
        />
      </div>

      {/* Inactive toggle */}
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
