import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface CrossFilter {
  level: 'campaign' | 'adset' | 'ad' | null;
  key: string | null;
  name: string | null;
}

interface CrossFilterCtx {
  filter: CrossFilter;
  setFilter: (f: CrossFilter) => void;
  clearFilter: () => void;
}

const EMPTY: CrossFilter = { level: null, key: null, name: null };

const CrossFilterContext = createContext<CrossFilterCtx>({
  filter: EMPTY,
  setFilter: () => {},
  clearFilter: () => {},
});

export function CrossFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<CrossFilter>(EMPTY);

  const setFilter = useCallback((f: CrossFilter) => {
    // Toggle off if same filter clicked again
    setFilterState(prev =>
      prev.key === f.key && prev.level === f.level ? EMPTY : f
    );
  }, []);

  const clearFilter = useCallback(() => setFilterState(EMPTY), []);

  return (
    <CrossFilterContext.Provider value={{ filter, setFilter, clearFilter }}>
      {children}
    </CrossFilterContext.Provider>
  );
}

export function useCrossFilter() {
  return useContext(CrossFilterContext);
}
