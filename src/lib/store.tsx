import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState, MetaRecord, ImportLog, MonthlyTargets, FunnelData, TruthSource, AnalysisLevel, HierarchyMaps } from './types';
import { getAvailableMonths, getPreviousMonth } from './calculations';

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
  | { type: 'SET_TRUTH_SOURCE'; source: TruthSource }
  | { type: 'SET_SELECTED_MONTH'; month: string }
  | { type: 'SET_COMPARISON_MONTH'; month: string }
  | { type: 'SET_ANALYSIS_LEVEL'; level: AnalysisLevel }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_INCLUDE_INACTIVE'; value: boolean }
  | { type: 'SET_TARGETS'; targets: MonthlyTargets }
  | { type: 'SET_FUNNEL'; funnel: FunnelData }
  | { type: 'CLEAR_ALL' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
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

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}
