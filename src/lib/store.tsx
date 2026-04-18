import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import type { AppState, MetaRecord, ImportLog, PeriodTargets, FunnelData, LeadQualityRecord, TruthSource, AnalysisLevel, HierarchyMaps, PeriodGranularity } from './types';
import { getDateBounds, computeComparisonRange, filterByDateRange, aggregateMetrics, computeDeltas, detectDefaultGranularity } from './calculations';
import { buildHierarchyMaps, enrichRecords, upsertRecords } from './parser';
import { loadRecords, saveRecords, loadTargets, saveTarget, loadFunnelData, saveFunnel, loadLeadQuality, clearAllData } from './persistence';

const initialState: AppState = {
  records: [],
  importLogs: [],
  targets: [],
  funnelData: [],
  leadQuality: [],
  hierarchyMaps: { ad_to_adset: {}, ad_to_campaign: {}, adset_to_campaign: {} },
  truthSource: 'type3_full',
  dateFrom: null,
  dateTo: null,
  comparisonFrom: null,
  comparisonTo: null,
  selectedGranularity: 'day',
  selectedPeriodKey: null,
  comparisonPeriodKey: null,
  analysisLevel: 'campaign',
  searchQuery: '',
  includeInactive: false,
};

type Action =
  | { type: 'SET_RECORDS'; records: MetaRecord[]; log: ImportLog; maps: HierarchyMaps }
  | { type: 'IMPORT_FILE'; newRecords: MetaRecord[]; log: ImportLog }
  | { type: 'SET_TRUTH_SOURCE'; source: TruthSource }
  | { type: 'SET_GRANULARITY'; granularity: PeriodGranularity }
  | { type: 'SET_DATE_RANGE'; from: string; to: string }
  | { type: 'SET_COMPARISON_RANGE'; from: string | null; to: string | null }
  | { type: 'SET_SELECTED_PERIOD'; periodKey: string }
  | { type: 'SET_COMPARISON_PERIOD'; periodKey: string }
  | { type: 'SET_ANALYSIS_LEVEL'; level: AnalysisLevel }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_INCLUDE_INACTIVE'; value: boolean }
  | { type: 'SET_TARGETS'; targets: PeriodTargets }
  | { type: 'SET_FUNNEL'; funnel: FunnelData }
  | { type: 'SET_LEAD_QUALITY'; data: LeadQualityRecord[] }
  | { type: 'CLEAR_ALL' }
  | { type: 'HYDRATE'; records: MetaRecord[]; targets: PeriodTargets[]; funnelData: FunnelData[]; leadQuality?: LeadQualityRecord[] };

function autoSelectDateRange(records: MetaRecord[]) {
  const bounds = getDateBounds(records);
  if (!bounds) return { dateFrom: null, dateTo: null, comparisonFrom: null, comparisonTo: null };

  const today = new Date().toISOString().slice(0, 10);
  const dateTo = bounds.max <= today ? bounds.max : today;

  // Default: last 7 days of data
  const from = new Date(dateTo + 'T00:00:00');
  from.setDate(from.getDate() - 6);
  const dateFrom = from.toISOString().slice(0, 10) < bounds.min ? bounds.min : from.toISOString().slice(0, 10);

  const comp = computeComparisonRange(dateFrom, dateTo);
  return { dateFrom, dateTo, comparisonFrom: comp.from, comparisonTo: comp.to };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE': {
      const records = action.records;
      const maps = buildHierarchyMaps(records);
      const granularity = detectDefaultGranularity(records);
      const dates = autoSelectDateRange(records);
      return {
        ...state,
        records,
        targets: action.targets,
        funnelData: action.funnelData,
        leadQuality: action.leadQuality || state.leadQuality,
        hierarchyMaps: maps,
        selectedGranularity: granularity,
        ...dates,
      };
    }
    case 'SET_RECORDS': {
      const records = action.records;
      const dates = autoSelectDateRange(records);
      return {
        ...state,
        records,
        importLogs: [...state.importLogs, action.log],
        hierarchyMaps: action.maps,
        ...dates,
      };
    }
    case 'IMPORT_FILE': {
      // Build hierarchy maps from the full dataset so we can cross-enrich records
      // coming from simpler exports (type1/type2) using ones from richer exports (type3).
      const maps = buildHierarchyMaps([...state.records, ...action.newRecords]);
      const enriched = enrichRecords(action.newRecords, maps);
      const records = upsertRecords(state.records, enriched);
      const dates = autoSelectDateRange(records);
      return {
        ...state,
        records,
        importLogs: [...state.importLogs, action.log],
        hierarchyMaps: maps,
        ...dates,
      };
    }
    case 'SET_TRUTH_SOURCE':
      return { ...state, truthSource: action.source };
    case 'SET_GRANULARITY':
      return { ...state, selectedGranularity: action.granularity };
    case 'SET_DATE_RANGE': {
      const comp = computeComparisonRange(action.from, action.to);
      return {
        ...state,
        dateFrom: action.from,
        dateTo: action.to,
        comparisonFrom: comp.from,
        comparisonTo: comp.to,
      };
    }
    case 'SET_COMPARISON_RANGE':
      return { ...state, comparisonFrom: action.from, comparisonTo: action.to };
    case 'SET_SELECTED_PERIOD':
      return { ...state, selectedPeriodKey: action.periodKey };
    case 'SET_COMPARISON_PERIOD':
      return { ...state, comparisonPeriodKey: action.periodKey };
    case 'SET_ANALYSIS_LEVEL':
      return { ...state, analysisLevel: action.level };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };
    case 'SET_INCLUDE_INACTIVE':
      return { ...state, includeInactive: action.value };
    case 'SET_TARGETS': {
      const existing = state.targets.filter(t => t.period_key !== action.targets.period_key);
      return { ...state, targets: [...existing, action.targets] };
    }
    case 'SET_FUNNEL': {
      const existing = state.funnelData.filter(f => f.period_key !== action.funnel.period_key);
      return { ...state, funnelData: [...existing, action.funnel] };
    }
    case 'SET_LEAD_QUALITY':
      return { ...state, leadQuality: action.data };
    case 'CLEAR_ALL':
      return initialState;
    default:
      return state;
  }
}

function usePersistingDispatch(
  dispatch: React.Dispatch<Action>,
  stateRef: React.MutableRefObject<AppState>,
) {
  return useCallback((action: Action) => {
    dispatch(action);

    // Wait for the reducer to run, then persist from the latest state. This
    // guarantees Supabase receives the enriched records (hierarchy-filled)
    // rather than the raw import.
    queueMicrotask(() => {
      const state = stateRef.current;
      switch (action.type) {
        case 'SET_RECORDS':
          saveRecords(state.records);
          break;
        case 'IMPORT_FILE': {
          // Persist only rows that were added or modified by this import, but
          // from the enriched state.
          const incomingKeys = new Set(
            action.newRecords.map((r) => `${r.unique_key}|${r.period_key}|${r.granularity}`),
          );
          const toSave = state.records.filter((r) =>
            incomingKeys.has(`${r.unique_key}|${r.period_key}|${r.granularity}`),
          );
          if (toSave.length) saveRecords(toSave);
          break;
        }
        case 'SET_TARGETS':
          saveTarget(action.targets);
          break;
        case 'SET_FUNNEL':
          saveFunnel(action.funnel);
          break;
        case 'CLEAR_ALL':
          clearAllData();
          break;
      }
    });
  }, [dispatch, stateRef]);
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dispatch = usePersistingDispatch(rawDispatch, stateRef);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    Promise.all([loadRecords(), loadTargets(), loadFunnelData(), loadLeadQuality()]).then(
      ([records, targets, funnelData, leadQuality]) => {
        if (records.length > 0 || targets.length > 0 || funnelData.length > 0 || leadQuality.length > 0) {
          rawDispatch({ type: 'HYDRATE', records, targets, funnelData, leadQuality });
        }
      }
    );
  }, []);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx!;
}

/** Hook that returns current & previous records filtered by date range */
export function useFilteredRecords() {
  const { state } = useAppState();
  return useMemo(() => {
    const current = state.dateFrom && state.dateTo
      ? filterByDateRange(state.records, state.dateFrom, state.dateTo, state.truthSource)
      : [];
    const previous = state.comparisonFrom && state.comparisonTo
      ? filterByDateRange(state.records, state.comparisonFrom, state.comparisonTo, state.truthSource)
      : [];
    return { current, previous };
  }, [state.records, state.dateFrom, state.dateTo, state.comparisonFrom, state.comparisonTo, state.truthSource]);
}
