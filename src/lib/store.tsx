import React, { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type { AppState, MetaRecord, ImportLog, MonthlyTargets, FunnelData, TruthSource, AnalysisLevel, HierarchyMaps } from './types';
import { getAvailableMonths, getPreviousMonth } from './calculations';
import { upsertRecords, buildHierarchyMaps, enrichRecords } from './parser';
import { loadRecords, saveRecords, loadTargets, saveTarget, loadFunnelData, saveFunnel, clearAllData } from './persistence';

const initialState: AppState = {
  records: [],
  importLogs: [],
  targets: [],
  funnelData: [],
  hierarchyMaps: { ad_to_adset: {}, ad_to_campaign: {}, adset_to_campaign: {} },
  truthSource: 'type3_full',
  selectedMonth: null,
  comparisonMonth: null,
  analysisLevel: 'campaign',
  searchQuery: '',
  includeInactive: false,
};

type Action =
  | { type: 'SET_RECORDS'; records: MetaRecord[]; log: ImportLog; maps: HierarchyMaps }
  | { type: 'IMPORT_FILE'; newRecords: MetaRecord[]; log: ImportLog }
  | { type: 'SET_TRUTH_SOURCE'; source: TruthSource }
  | { type: 'SET_SELECTED_MONTH'; month: string }
  | { type: 'SET_COMPARISON_MONTH'; month: string }
  | { type: 'SET_ANALYSIS_LEVEL'; level: AnalysisLevel }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_INCLUDE_INACTIVE'; value: boolean }
  | { type: 'SET_TARGETS'; targets: MonthlyTargets }
  | { type: 'SET_FUNNEL'; funnel: FunnelData }
  | { type: 'CLEAR_ALL' }
  | { type: 'HYDRATE'; records: MetaRecord[]; targets: MonthlyTargets[]; funnelData: FunnelData[] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE': {
      const records = action.records;
      const maps = buildHierarchyMaps(records);
      const months = getAvailableMonths(records);
      const selectedMonth = months[0] || null;
      const comparisonMonth = selectedMonth ? getPreviousMonth(selectedMonth) : null;
      return {
        ...state,
        records,
        targets: action.targets,
        funnelData: action.funnelData,
        hierarchyMaps: maps,
        selectedMonth,
        comparisonMonth: comparisonMonth && months.includes(comparisonMonth) ? comparisonMonth : months[1] || null,
      };
    }
    case 'SET_RECORDS': {
      const records = action.records;
      const months = getAvailableMonths(records);
      const selectedMonth = state.selectedMonth && months.includes(state.selectedMonth) 
        ? state.selectedMonth 
        : months[0] || null;
      const comparisonMonth = selectedMonth ? getPreviousMonth(selectedMonth) : null;
      return {
        ...state,
        records,
        importLogs: [...state.importLogs, action.log],
        hierarchyMaps: action.maps,
        selectedMonth,
        comparisonMonth: comparisonMonth && months.includes(comparisonMonth) ? comparisonMonth : months[1] || null,
      };
    }
    case 'IMPORT_FILE': {
      const maps = buildHierarchyMaps([...state.records, ...action.newRecords]);
      const enriched = enrichRecords(action.newRecords, maps);
      const records = upsertRecords(state.records, enriched);
      const months = getAvailableMonths(records);
      const selectedMonth = state.selectedMonth && months.includes(state.selectedMonth)
        ? state.selectedMonth
        : months[0] || null;
      const comparisonMonth = selectedMonth ? getPreviousMonth(selectedMonth) : null;
      return {
        ...state,
        records,
        importLogs: [...state.importLogs, action.log],
        hierarchyMaps: maps,
        selectedMonth,
        comparisonMonth: comparisonMonth && months.includes(comparisonMonth) ? comparisonMonth : months[1] || null,
      };
    }
    case 'SET_TRUTH_SOURCE':
      return { ...state, truthSource: action.source };
    case 'SET_SELECTED_MONTH':
      return { ...state, selectedMonth: action.month, comparisonMonth: getPreviousMonth(action.month) };
    case 'SET_COMPARISON_MONTH':
      return { ...state, comparisonMonth: action.month };
    case 'SET_ANALYSIS_LEVEL':
      return { ...state, analysisLevel: action.level };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };
    case 'SET_INCLUDE_INACTIVE':
      return { ...state, includeInactive: action.value };
    case 'SET_TARGETS': {
      const existing = state.targets.filter(t => t.month_key !== action.targets.month_key);
      return { ...state, targets: [...existing, action.targets] };
    }
    case 'SET_FUNNEL': {
      const existing = state.funnelData.filter(f => f.month_key !== action.funnel.month_key);
      return { ...state, funnelData: [...existing, action.funnel] };
    }
    case 'CLEAR_ALL':
      return initialState;
    default:
      return state;
  }
}

// Middleware wrapper to persist side effects
function usePersistingDispatch(dispatch: React.Dispatch<Action>) {
  return React.useCallback((action: Action) => {
    dispatch(action);

    // Fire-and-forget persistence
    switch (action.type) {
      case 'SET_RECORDS':
        saveRecords(action.records);
        break;
      case 'IMPORT_FILE':
        saveRecords(action.newRecords);
        break;
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
  }, [dispatch]);
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const dispatch = usePersistingDispatch(rawDispatch);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    Promise.all([loadRecords(), loadTargets(), loadFunnelData()]).then(
      ([records, targets, funnelData]) => {
        if (records.length > 0 || targets.length > 0 || funnelData.length > 0) {
          rawDispatch({ type: 'HYDRATE', records, targets, funnelData });
        }
      }
    );
  }, []);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
