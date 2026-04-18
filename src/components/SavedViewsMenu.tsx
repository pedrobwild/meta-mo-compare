// ─── SavedViewsMenu ───
// Dropdown to save and recall named filter combinations. Uses localStorage,
// scoped per workspace. The user can also copy a shareable URL encoding the
// current filter state.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Check, Copy, Link2, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppState } from '@/lib/store';
import { useWorkspace } from '@/lib/workspace';
import {
  listSavedViews, saveView, deleteSavedView, payloadToSearchParams, randomId,
  type SavedView, type SavedViewPayload,
} from '@/lib/savedViews';
import { toast } from 'sonner';
import type { Tab } from '@/components/AppSidebar';

interface SavedViewsMenuProps {
  activeTab: Tab;
  onApplyView: (payload: Partial<SavedViewPayload>) => void;
}

export default function SavedViewsMenu({ activeTab, onApplyView }: SavedViewsMenuProps) {
  const { state } = useAppState();
  const { workspace } = useWorkspace();
  const [views, setViews] = useState<SavedView[]>([]);
  const [draftName, setDraftName] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setViews(listSavedViews(workspace?.id));
  }, [workspace?.id]);

  const currentPayload = useMemo<SavedViewPayload>(
    () => ({
      activeTab,
      dateFrom: state.dateFrom,
      dateTo: state.dateTo,
      comparisonFrom: state.comparisonFrom,
      comparisonTo: state.comparisonTo,
      analysisLevel: state.analysisLevel,
      searchQuery: state.searchQuery,
      includeInactive: state.includeInactive,
      selectedPeriodKey: state.selectedPeriodKey,
      comparisonPeriodKey: state.comparisonPeriodKey,
      selectedGranularity: state.selectedGranularity,
    }),
    [activeTab, state.dateFrom, state.dateTo, state.comparisonFrom, state.comparisonTo,
      state.analysisLevel, state.searchQuery, state.includeInactive,
      state.selectedPeriodKey, state.comparisonPeriodKey, state.selectedGranularity],
  );

  const handleSave = useCallback(() => {
    const name = draftName.trim();
    if (!name) {
      toast.error('Dê um nome à visualização.');
      return;
    }
    const view: SavedView = {
      id: randomId(),
      name,
      createdAt: new Date().toISOString(),
      payload: currentPayload,
    };
    const next = saveView(workspace?.id, view);
    setViews(next);
    setDraftName('');
    toast.success(`Visualização "${name}" salva`);
  }, [draftName, currentPayload, workspace?.id]);

  const handleDelete = useCallback(
    (id: string) => {
      const next = deleteSavedView(workspace?.id, id);
      setViews(next);
    },
    [workspace?.id],
  );

  const handleApply = useCallback(
    (v: SavedView) => {
      onApplyView(v.payload);
      setOpen(false);
      toast.success(`Aplicada: ${v.name}`);
    },
    [onApplyView],
  );

  const handleCopyUrl = useCallback(() => {
    const sp = payloadToSearchParams(currentPayload);
    const url = `${window.location.origin}${window.location.pathname}?${sp.toString()}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Link copiado para a área de transferência'),
      () => toast.error('Falha ao copiar'),
    );
  }, [currentPayload]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Bookmark className="h-3.5 w-3.5" />
          Views
          {views.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px]">
              {views.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          Visualizações salvas
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1"
            onClick={handleCopyUrl}
          >
            <Link2 className="h-3 w-3" />
            Copiar link
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="px-2 pb-2 flex gap-1 items-center">
          <Input
            placeholder="Nome da view atual"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            variant="default"
            className="h-8 w-8 p-0"
            onClick={handleSave}
            title="Salvar view atual"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {views.length === 0 ? (
          <div className="px-3 pb-3 text-[11px] text-muted-foreground">
            <Star className="inline h-3 w-3 mr-1" />
            Salve combinações de filtros para retornar rapidamente.
          </div>
        ) : (
          <>
            <DropdownMenuSeparator />
            <div className="max-h-64 overflow-y-auto">
              {views.map((v) => (
                <div
                  key={v.id}
                  className="flex items-start gap-2 px-2 py-1.5 hover:bg-accent/40 rounded-sm group"
                >
                  <DropdownMenuItem
                    className="flex-1 cursor-pointer min-w-0 p-1"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleApply(v);
                    }}
                  >
                    <Check className="h-3 w-3 mr-1.5 opacity-0 group-hover:opacity-50" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {v.payload.activeTab} · {v.payload.dateFrom || '—'} → {v.payload.dateTo || '—'}
                      </p>
                    </div>
                  </DropdownMenuItem>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-50 hover:opacity-100 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(v.id);
                    }}
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleCopyUrl();
          }}
          className="text-[11px] text-muted-foreground"
        >
          <Copy className="h-3 w-3 mr-2" /> Copiar URL da view atual
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
