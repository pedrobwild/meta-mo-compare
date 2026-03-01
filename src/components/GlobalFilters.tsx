import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ArrowRightLeft, Search, Filter, Layers } from 'lucide-react';
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
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
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
    : 'Período';

  const compLabel = state.comparisonFrom && state.comparisonTo
    ? getDateRangeLabel(state.comparisonFrom, state.comparisonTo)
    : 'Comparar';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Quick presets */}
      <div className="flex items-center gap-0.5">
        {PRESETS.map(p => (
          <Button
            key={p.days}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-secondary"
            onClick={() => applyPreset(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Date Range Picker */}
      <Popover open={mainOpen} onOpenChange={setMainOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-7 gap-1.5 text-[11px] font-mono bg-surface-2/50 border-border hover:border-primary/30 hover:bg-surface-2',
              !state.dateFrom && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {mainLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-wrap gap-1 p-2 pb-0 border-b border-border">
            {PRESETS.map(p => (
              <Button key={p.days} variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => { applyPreset(p.days); setMainOpen(false); }}>
                {p.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => { applyMonthPreset(0); setMainOpen(false); }}>
              Mês atual
            </Button>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => { applyMonthPreset(-1); setMainOpen(false); }}>
              Mês anterior
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

      {/* Comparison Range */}
      <Popover open={compOpen} onOpenChange={setCompOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-7 gap-1.5 text-[11px] font-mono bg-surface-2/50 border-border hover:border-primary/30',
              !state.comparisonFrom && 'text-muted-foreground'
            )}
          >
            <ArrowRightLeft className="h-3 w-3" />
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

      <div className="h-4 w-px bg-border" />

      {/* Analysis Level */}
      <Select value={state.analysisLevel} onValueChange={l => dispatch({ type: 'SET_ANALYSIS_LEVEL', level: l as AnalysisLevel })}>
        <SelectTrigger className="h-7 w-auto gap-1 text-[11px] bg-surface-2/50 border-border px-2 [&>svg]:h-3 [&>svg]:w-3">
          <Layers className="h-3 w-3 text-muted-foreground mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="campaign">Campanha</SelectItem>
          <SelectItem value="adset">Conjunto</SelectItem>
          <SelectItem value="ad">Anúncio</SelectItem>
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          value={state.searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
          className="h-7 w-36 pl-7 text-[11px] bg-surface-2/50 border-border focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Inactive toggle */}
      <div className="flex items-center gap-1.5">
        <Switch
          checked={state.includeInactive}
          onCheckedChange={v => dispatch({ type: 'SET_INCLUDE_INACTIVE', value: v })}
          className="scale-75"
        />
        <Label className="text-[10px] text-muted-foreground">Inativos</Label>
      </div>
    </div>
  );
}
