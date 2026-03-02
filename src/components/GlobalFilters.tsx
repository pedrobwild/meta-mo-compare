import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ArrowRightLeft, Search, Layers, Download, RefreshCw } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { getDateBounds, getDateRangeLabel } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import MetaSyncButton from './MetaSyncButton';
import { cn } from '@/lib/utils';
import type { AnalysisLevel } from '@/lib/types';
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
      dispatch({ type: 'SET_DATE_RANGE', from: format(range.from, 'yyyy-MM-dd'), to: format(range.to, 'yyyy-MM-dd') });
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
    dispatch({ type: 'SET_DATE_RANGE', from: format(startOfMonth(ref), 'yyyy-MM-dd'), to: format(endOfMonth(ref), 'yyyy-MM-dd') });
  };

  const mainLabel = state.dateFrom && state.dateTo
    ? getDateRangeLabel(state.dateFrom, state.dateTo)
    : 'Período';

  const compLabel = state.comparisonFrom && state.comparisonTo
    ? getDateRangeLabel(state.comparisonFrom, state.comparisonTo)
    : 'Comparar';

  const activePreset = (() => {
    if (!state.dateFrom || !state.dateTo || !bounds) return null;
    const maxDate = new Date(bounds.max + 'T00:00:00');
    const to = format(maxDate, 'yyyy-MM-dd');
    if (state.dateTo !== to) return null;
    for (const p of PRESETS) {
      const from = format(subDays(maxDate, p.days - 1), 'yyyy-MM-dd');
      if (state.dateFrom === from) return p.days;
    }
    return null;
  })();

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {/* Period pill presets */}
      <div className="flex items-center gap-1">
        {PRESETS.map(p => (
          <button
            key={p.days}
            onClick={() => applyPreset(p.days)}
            className={cn(
              'meta-pill meta-button-press',
              activePreset === p.days ? 'meta-pill-active' : 'meta-pill-inactive'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Date Range Picker */}
      <Popover open={mainOpen} onOpenChange={setMainOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-meta-body rounded-meta-btn border-border hover:bg-secondary meta-button-press',
              !state.dateFrom && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
            {mainLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-meta-card shadow-meta-card" align="start">
          <div className="flex flex-wrap gap-1 p-2 pb-0 border-b border-border">
            {PRESETS.map(p => (
              <Button key={p.days} variant="ghost" size="sm" className="text-[10px] h-6 px-2 rounded-meta-btn" onClick={() => { applyPreset(p.days); setMainOpen(false); }}>
                {p.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 rounded-meta-btn" onClick={() => { applyMonthPreset(0); setMainOpen(false); }}>
              Mês atual
            </Button>
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 rounded-meta-btn" onClick={() => { applyMonthPreset(-1); setMainOpen(false); }}>
              Mês anterior
            </Button>
          </div>
          <Calendar
            mode="range"
            selected={{ from: mainFrom, to: mainTo }}
            onSelect={handleMainSelect}
            numberOfMonths={2}
            className="p-3 pointer-events-auto"
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      {/* Comparison */}
      <Popover open={compOpen} onOpenChange={setCompOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-meta-body rounded-meta-btn border-border hover:bg-secondary meta-button-press',
              !state.comparisonFrom && 'text-muted-foreground'
            )}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            {compLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-meta-card shadow-meta-card" align="start">
          <Calendar
            mode="range"
            selected={{ from: compFrom, to: compTo }}
            onSelect={handleCompSelect}
            numberOfMonths={2}
            className="p-3 pointer-events-auto"
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      <div className="h-5 w-px bg-border" />

      {/* Analysis Level */}
      <Select value={state.analysisLevel} onValueChange={l => dispatch({ type: 'SET_ANALYSIS_LEVEL', level: l as AnalysisLevel })}>
        <SelectTrigger className="h-8 w-auto gap-1 text-meta-body border-border px-2.5 rounded-meta-btn [&>svg]:h-3 [&>svg]:w-3">
          <Layers className="h-3.5 w-3.5 text-muted-foreground mr-1" strokeWidth={1.5} />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-meta-card shadow-meta-card">
          <SelectItem value="campaign">Campanha</SelectItem>
          <SelectItem value="adset">Conjunto</SelectItem>
          <SelectItem value="ad">Anúncio</SelectItem>
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        <Input
          placeholder="Buscar..."
          value={state.searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH_QUERY', query: e.target.value })}
          className="h-8 w-40 pl-8 text-meta-body border-border rounded-meta-btn focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Inactive toggle */}
      <div className="flex items-center gap-1.5">
        <Switch
          checked={state.includeInactive}
          onCheckedChange={v => dispatch({ type: 'SET_INCLUDE_INACTIVE', value: v })}
          className="scale-[0.85]"
        />
        <Label className="text-meta-caption text-muted-foreground">Inativos</Label>
      </div>

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-2">
        <MetaSyncButton />
      </div>
    </div>
  );
}
