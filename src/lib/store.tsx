import React, { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react';
import type { AppState, MetaRecord, ImportLog, PeriodTargets, FunnelData, TruthSource, AnalysisLevel, HierarchyMaps, PeriodGranularity } from './types';
import { getAvailablePeriods, getPreviousPeriod, detectDefaultGranularity } from './calculations';
import { upsertRecords, buildHierarchyMaps, enrichRecords } from './parser';
import { loadRecords, saveRecords, loadTargets, saveTarget, loadFunnelData, saveFunnel, clearAllData } from './persistence';

const initialState: AppState = {
  records: [],
  importLogs: [],
  targets: [],
  funnelData: [],
  hierarchyMaps: { ad_to_adset: {}, ad_to_campaign: {}, adset_to_campaign: {} },
  truthSource: 'type3_full',
  selectedGranularity: 'week',
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
  | { type: 'SET_SELECTED_PERIOD'; periodKey: string }
  | { type: 'SET_COMPARISON_PERIOD'; periodKey: string }
  | { type: 'SET_ANALYSIS_LEVEL'; level: AnalysisLevel }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_INCLUDE_INACTIVE'; value: boolean }
  | { type: 'SET_TARGETS'; targets: PeriodTargets }
  | { type: 'SET_FUNNEL'; funnel: FunnelData }
  | { type: 'CLEAR_ALL' }
  | { type: 'HYDRATE'; records: MetaRecord[]; targets: PeriodTargets[]; funnelData: FunnelData[] };

function autoSelectPeriod(records: MetaRecord[], granularity: PeriodGranularity, currentPeriodKey: string | null) {
  const periods = getAvailablePeriods(records, granularity);
  const selectedPeriodKey = currentPeriodKey && periods.includes(currentPeriodKey)
    ? currentPeriodKey
    : periods[0] || null;
  const comparisonPeriodKey = selectedPeriodKey
    ? (periods.includes(getPreviousPeriod(selectedPeriodKey, granularity))
      ? getPreviousPeriod(selectedPeriodKey, granularity)
      : periods[1] || null)
    : null;
  return { selectedPeriodKey, comparisonPeriodKey };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE': {
      const records = action.records;
      const maps = buildHierarchyMaps(records);
      const granularity = detectDefaultGranularity(records);
      const { selectedPeriodKey, comparisonPeriodKey } = autoSelectPeriod(records, granularity, null);
      return {
        ...state,
        records,
        targets: action.targets,
        funnelData: action.funnelData,
        hierarchyMaps: maps,
        selectedGranularity: granularity,
        selectedPeriodKey,
        comparisonPeriodKey,
      };
    }
    case 'SET_RECORDS': {
      const records = action.records;
      const { selectedPeriodKey, comparisonPeriodKey } = autoSelectPeriod(records, state.selectedGranularity, state.selectedPeriodKey);
      return {
        ...state,
        records,
        importLogs: [...state.importLogs, action.log],
        hierarchyMaps: action.maps,
        selectedPeriodKey,
        comparisonPeriodKey,
      };
    }
    case 'IMPORT_FILE': {
      const maps = buildHierarchyMaps([...state.records, ...action.newRecords]);
      const enriched = enrichRecords(action.newRecords, maps);
      const records = upsertRecords(state.records, enriched);
      const granularity = detectDefaultGranularity(records);
      const { selectedPeriodKey, comparisonPeriodKey } = autoSelectPeriod(records, granularity, state.selectedPeriodKey);
      return {
        ...state,
        records,
        importLogs: [...state.importLogs, action.log],
        hierarchyMaps: maps,
        selectedGranularity: granularity,
        selectedPeriodKey,
        comparisonPeriodKey,
      };
    }
    case 'SET_TRUTH_SOURCE':
      return { ...state, truthSource: action.source };
    case 'SET_GRANULARITY': {
      const { selectedPeriodKey, comparisonPeriodKey } = autoSelectPeriod(state.records, action.granularity, null);
      return { ...state, selectedGranularity: action.granularity, selectedPeriodKey, comparisonPeriodKey };
    }
    case 'SET_SELECTED_PERIOD': {
      const comp = getPreviousPeriod(action.periodKey, state.selectedGranularity);
      const periods = getAvailablePeriods(state.records, state.selectedGranularity);
      return {
        ...state,
        selectedPeriodKey: action.periodKey,
        comparisonPeriodKey: periods.includes(comp) ? comp : periods.find(p => p !== action.periodKey) || null,
      };
    }
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
    case 'CLEAR_ALL':
      return initialState;
    default:
      return state;
  }
}

function usePersistingDispatch(dispatch: React.Dispatch<Action>) {
  return React.useCallback((action: Action) => {
    dispatch(action);

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
