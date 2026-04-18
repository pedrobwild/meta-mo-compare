// ─── CommandPalette ───
// Global command palette (cmd+K / ctrl+K) for fast keyboard navigation.
// Offers: tab navigation, quick actions (clear filters, export CSV, toggle
// include-inactive), search into campaigns/adsets/ads, and shortcuts to key
// features like the simulator and decisions log. Designed to stay invisible
// until summoned and dismissible with Esc.

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Search, Crosshair, Palette, UserCircle, Bell, Zap, Bot,
  SplitSquareHorizontal, AlertOctagon, TrendingUp,
  Activity, Users, Contact, Instagram, Link2, Calculator, FileText,
  History, FlaskConical, Gauge, GitBranch, Lightbulb,
  RefreshCw, Download, FilterX, XCircle, Eye, EyeOff,
} from 'lucide-react';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup,
  CommandItem, CommandShortcut, CommandSeparator,
} from '@/components/ui/command';
import { useAppState } from '@/lib/store';
import { useCrossFilter } from '@/lib/crossFilter';
import { toast } from 'sonner';
import type { Tab } from '@/components/AppSidebar';

interface CommandPaletteProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const NAV_ITEMS: { key: Tab; label: string; icon: any; group: string }[] = [
  { key: 'executive', label: 'Executivo', icon: BarChart3, group: 'Análise' },
  { key: 'tactical', label: 'Tático', icon: Crosshair, group: 'Análise' },
  { key: 'diagnostic', label: 'Diagnóstico', icon: Search, group: 'Análise' },
  { key: 'creatives', label: 'Criativos', icon: Palette, group: 'Análise' },
  { key: 'personas', label: 'Personas', icon: UserCircle, group: 'Análise' },
  { key: 'alerts', label: 'Alertas', icon: Bell, group: 'Análise' },
  { key: 'actions', label: 'Ações', icon: Zap, group: 'Análise' },
  { key: 'ai', label: 'IA Analyst', icon: Bot, group: 'Análise' },
  { key: 'ab-test', label: 'A/B Test', icon: SplitSquareHorizontal, group: 'Estatística' },
  { key: 'anomalies', label: 'Anomalias', icon: AlertOctagon, group: 'Estatística' },
  { key: 'forecast', label: 'Forecast', icon: TrendingUp, group: 'Estatística' },
  { key: 'funnel', label: 'Funil', icon: Activity, group: 'Dados' },
  { key: 'funnel-real', label: 'Funil Real', icon: Users, group: 'Dados' },
  { key: 'leads', label: 'Lead Ads', icon: Contact, group: 'Dados' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, group: 'Dados' },
  { key: 'utm-builder', label: 'UTM Builder', icon: Link2, group: 'Configuração' },
  { key: 'simulator', label: 'Simulador', icon: Calculator, group: 'Configuração' },
  { key: 'report', label: 'Relatório', icon: FileText, group: 'Configuração' },
  { key: 'decisions', label: 'Decisões', icon: History, group: 'Configuração' },
  { key: 'experiments', label: 'Experimentos', icon: FlaskConical, group: 'Configuração' },
  { key: 'benchmarks', label: 'Benchmarks', icon: Gauge, group: 'Configuração' },
  { key: 'health', label: 'Saúde', icon: GitBranch, group: 'Configuração' },
  { key: 'missing', label: 'Lacunas', icon: Lightbulb, group: 'Configuração' },
];

export default function CommandPalette({ activeTab, onTabChange }: CommandPaletteProps) {
  const { state, dispatch } = useAppState();
  const { filter: crossFilter, clearFilter } = useCrossFilter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Global cmd+K / ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Reset query when closed so next open starts fresh.
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    // Let the dialog close animation start before running; avoids focus fights.
    setTimeout(fn, 0);
  };

  // Build searchable entity index (campaigns/adsets/ads by name).
  const entities = useMemo(() => {
    const seen = new Set<string>();
    const list: { key: string; name: string; level: 'campaign' | 'adset' | 'ad' }[] = [];
    for (const r of state.records) {
      if (r.campaign_key && r.campaign_name) {
        const id = `c:${r.campaign_key}`;
        if (!seen.has(id)) {
          seen.add(id);
          list.push({ key: r.campaign_key, name: r.campaign_name, level: 'campaign' });
        }
      }
      if (r.adset_key && r.adset_name) {
        const id = `as:${r.adset_key}`;
        if (!seen.has(id)) {
          seen.add(id);
          list.push({ key: r.adset_key, name: r.adset_name, level: 'adset' });
        }
      }
      if (r.ad_key && r.ad_name) {
        const id = `ad:${r.ad_key}`;
        if (!seen.has(id)) {
          seen.add(id);
          list.push({ key: r.ad_key, name: r.ad_name, level: 'ad' });
        }
      }
    }
    // Sort by name to make the palette feel consistent.
    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [state.records]);

  const filteredEntities = useMemo(() => {
    if (!query.trim() || query.length < 2) return [] as typeof entities;
    const q = query.toLowerCase();
    return entities.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 25);
  }, [entities, query]);

  const goTo = (tab: Tab) => run(() => onTabChange(tab));

  const clearFiltersAction = () =>
    run(() => {
      dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
      if (crossFilter.key) clearFilter();
      toast.success('Filtros limpos');
    });

  const toggleIncludeInactive = () =>
    run(() => {
      dispatch({ type: 'SET_INCLUDE_INACTIVE', value: !state.includeInactive });
      toast.info(state.includeInactive ? 'Inativos ocultos' : 'Inativos incluídos');
    });

  const resetAll = () =>
    run(() => {
      if (!confirm('Tem certeza que deseja limpar todos os dados carregados?')) return;
      dispatch({ type: 'CLEAR_ALL' });
      toast.warning('Dados limpos.');
    });

  const exportHeatmapCsv = () =>
    run(() => {
      const table = document.querySelector('[data-ranking-table]');
      if (!table) {
        toast.error('Abra a aba Tático para exportar a tabela.');
        onTabChange('tactical');
        return;
      }
      const rows: string[][] = [];
      table.querySelectorAll('tr').forEach((tr) => {
        const cells = tr.querySelectorAll('th, td');
        const row: string[] = [];
        cells.forEach((c) => row.push((c.textContent || '').trim().replace(/\s+/g, ' ')));
        if (row.some((v) => v.length > 0)) rows.push(row);
      });
      if (rows.length === 0) {
        toast.error('Nenhuma linha na tabela.');
        return;
      }
      const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatmap_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exportado.');
    });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar, navegar ou executar uma ação..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        <CommandGroup heading="Ações rápidas">
          <CommandItem onSelect={clearFiltersAction}>
            <FilterX className="mr-2 h-4 w-4 text-muted-foreground" />
            Limpar filtros
            <CommandShortcut>⌫</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={toggleIncludeInactive}>
            {state.includeInactive ? (
              <EyeOff className="mr-2 h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
            )}
            {state.includeInactive ? 'Ocultar inativos' : 'Incluir inativos'}
          </CommandItem>
          <CommandItem onSelect={() => goTo('tactical')}>
            <RefreshCw className="mr-2 h-4 w-4 text-muted-foreground" />
            Sincronizar dados do Meta
          </CommandItem>
          <CommandItem onSelect={exportHeatmapCsv}>
            <Download className="mr-2 h-4 w-4 text-muted-foreground" />
            Exportar tabela (CSV)
          </CommandItem>
          <CommandItem onSelect={resetAll}>
            <XCircle className="mr-2 h-4 w-4 text-destructive" />
            Limpar todos os dados carregados
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {['Análise', 'Estatística', 'Dados', 'Configuração'].map((groupName) => (
          <CommandGroup key={groupName} heading={groupName}>
            {NAV_ITEMS.filter((n) => n.group === groupName).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <CommandItem
                  key={item.key}
                  onSelect={() => goTo(item.key)}
                  value={`nav ${groupName} ${item.label}`}
                >
                  <Icon className={`mr-2 h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  {item.label}
                  {isActive && <CommandShortcut>atual</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}

        {filteredEntities.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Buscar campanhas / conjuntos / anúncios">
              {filteredEntities.map((e) => (
                <CommandItem
                  key={`${e.level}:${e.key}`}
                  value={`entity ${e.level} ${e.name}`}
                  onSelect={() =>
                    run(() => {
                      dispatch({ type: 'SET_SEARCH_QUERY', query: e.name });
                      onTabChange('tactical');
                      toast.success(`Filtrando por "${e.name}"`);
                    })
                  }
                >
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{e.name}</span>
                  <CommandShortcut>
                    {e.level === 'campaign' ? 'campanha' : e.level === 'adset' ? 'conjunto' : 'anúncio'}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
