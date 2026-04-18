// ─── Saved Views ───
// Persist named combinations of filters (date range, comparison range,
// analysis level, search query, active tab) to localStorage, scoped by
// workspace so different accounts don't collide. Also exposes helpers to
// serialize / deserialize the same state to a URL query string for deep
// linking and share-able views.

export interface SavedViewPayload {
  activeTab: string;
  dateFrom: string | null;
  dateTo: string | null;
  comparisonFrom: string | null;
  comparisonTo: string | null;
  analysisLevel: 'campaign' | 'adset' | 'ad';
  searchQuery: string;
  includeInactive: boolean;
  selectedPeriodKey: string | null;
  comparisonPeriodKey: string | null;
  selectedGranularity: 'day' | 'week';
}

export interface SavedView {
  id: string;
  name: string;
  createdAt: string;
  payload: SavedViewPayload;
}

const VERSION = 1;
const KEY_PREFIX = 'meta-saved-views:v' + VERSION;

function storageKey(workspaceId: string | null | undefined): string {
  return `${KEY_PREFIX}:${workspaceId || 'local'}`;
}

export function listSavedViews(workspaceId: string | null | undefined): SavedView[] {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveView(workspaceId: string | null | undefined, view: SavedView): SavedView[] {
  const list = listSavedViews(workspaceId).filter((v) => v.id !== view.id);
  list.unshift(view);
  // Cap at 25 saved views per workspace.
  const trimmed = list.slice(0, 25);
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(trimmed));
  } catch {
    /* storage full or blocked — fail silently */
  }
  return trimmed;
}

export function deleteSavedView(workspaceId: string | null | undefined, id: string): SavedView[] {
  const list = listSavedViews(workspaceId).filter((v) => v.id !== id);
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(list));
  } catch {
    /* noop */
  }
  return list;
}

/**
 * Serialize a SavedViewPayload into a compact URL search string.
 * Keys are short (2-3 chars) to keep URLs tweet-able.
 */
export function payloadToSearchParams(p: SavedViewPayload): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.activeTab) sp.set('tab', p.activeTab);
  if (p.dateFrom) sp.set('df', p.dateFrom);
  if (p.dateTo) sp.set('dt', p.dateTo);
  if (p.comparisonFrom) sp.set('cf', p.comparisonFrom);
  if (p.comparisonTo) sp.set('ct', p.comparisonTo);
  if (p.analysisLevel && p.analysisLevel !== 'campaign') sp.set('lvl', p.analysisLevel);
  if (p.searchQuery) sp.set('q', p.searchQuery);
  if (p.includeInactive) sp.set('inactive', '1');
  if (p.selectedPeriodKey) sp.set('pk', p.selectedPeriodKey);
  if (p.comparisonPeriodKey) sp.set('cpk', p.comparisonPeriodKey);
  if (p.selectedGranularity && p.selectedGranularity !== 'day') sp.set('g', p.selectedGranularity);
  return sp;
}

export function searchParamsToPayload(sp: URLSearchParams): Partial<SavedViewPayload> {
  const level = sp.get('lvl');
  const g = sp.get('g');
  return {
    activeTab: sp.get('tab') || undefined,
    dateFrom: sp.get('df'),
    dateTo: sp.get('dt'),
    comparisonFrom: sp.get('cf'),
    comparisonTo: sp.get('ct'),
    analysisLevel: level === 'adset' || level === 'ad' ? (level as SavedViewPayload['analysisLevel']) : undefined,
    searchQuery: sp.get('q') || '',
    includeInactive: sp.get('inactive') === '1',
    selectedPeriodKey: sp.get('pk'),
    comparisonPeriodKey: sp.get('cpk'),
    selectedGranularity: g === 'week' ? 'week' : g === 'day' ? 'day' : undefined,
  } as Partial<SavedViewPayload>;
}

export function randomId(): string {
  return `sv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
