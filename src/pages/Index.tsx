import { useEffect, useRef, useState } from 'react';
import { Cloud, BarChart3, Zap, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppProvider, useAppState } from '@/lib/store';
import { useWorkspace } from '@/lib/workspace';
import { CrossFilterProvider, useCrossFilter } from '@/lib/crossFilter';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar, type Tab } from '@/components/AppSidebar';
import MetaTopbar from '@/components/MetaTopbar';
import CommandHeader from '@/components/CommandHeader';
import OverviewCards from '@/components/OverviewCards';
import HeatmapTable from '@/components/HeatmapTable';
import OverviewCharts from '@/components/OverviewCharts';
import AdvancedCharts from '@/components/AdvancedCharts';
import FunnelView from '@/components/FunnelView';
import ReportView from '@/components/ReportView';
import DataHealthView from '@/components/DataHealthView';
import TargetsEditor from '@/components/TargetsEditor';
import InsightCards from '@/components/InsightCards';
import ComparisonCards from '@/components/ComparisonCards';
import AdComparisonSelector from '@/components/AdComparisonSelector';
import ActionPanel from '@/components/ActionPanel';
import ExecutiveView from '@/components/ExecutiveView';
import MissingDataPanel from '@/components/MissingDataPanel';
import PacingCard from '@/components/PacingCard';
import AlertsBanner from '@/components/AlertsBanner';
import BudgetSimulator from '@/components/BudgetSimulator';
import DecisionsModule from '@/components/DecisionsModule';
import MetaSyncButton from '@/components/MetaSyncButton';
import OnboardingTour from '@/components/OnboardingTour';
import ActionCenter from '@/components/ActionCenter';
import AlertsView from '@/components/AlertsView';
import AIChatPanel from '@/components/AIChatPanel';
import AIRecommendationsPanel from '@/components/AIRecommendationsPanel';
import FunnelRealView from '@/components/FunnelRealView';
import CreativesView from '@/components/CreativesView';
import LeadsView from '@/components/LeadsView';
import InstagramView from '@/components/InstagramView';
import ExperimentsView from '@/components/ExperimentsView';
import ABTestAnalyzer from '@/components/ABTestAnalyzer';
import AnomalyDetectionView from '@/components/AnomalyDetectionView';
import ForecastView from '@/components/ForecastView';
import CommandPalette from '@/components/CommandPalette';
import SavedViewsMenu from '@/components/SavedViewsMenu';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  payloadToSearchParams,
  searchParamsToPayload,
  type SavedViewPayload,
} from '@/lib/savedViews';
import UtmBuilderView from '@/components/UtmBuilderView';
import BenchmarksView from '@/components/BenchmarksView';
import PersonaAudienceView from '@/components/PersonaAudienceView';
import Auth from '@/pages/Auth';

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="text-center space-y-6 max-w-md mx-auto px-4"
      >
        <div className="h-16 w-16 mx-auto rounded-meta-card bg-accent flex items-center justify-center">
          <Cloud className="h-8 w-8 text-primary" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-meta-title text-foreground">
            Meta Ads <span className="text-primary">Command Center</span>
          </h2>
          <p className="text-meta-body text-muted-foreground leading-relaxed">
            Conecte seus dados do Meta Ads para desbloquear análises de performance, alertas inteligentes e recomendações acionáveis.
          </p>
        </div>
        <MetaSyncButton />
        <div className="flex items-center justify-center gap-6 text-meta-label text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3 w-3" strokeWidth={1.5} /> Alertas em tempo real
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" strokeWidth={1.5} /> Análise profunda
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function ViewContainer({
  children,
  label,
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <ErrorBoundary label={label}>{children}</ErrorBoundary>
    </motion.div>
  );
}

function DashboardContent() {
  const { state, dispatch } = useAppState();
  const { user, loading: wsLoading } = useWorkspace();
  const [activeTab, setActiveTab] = useState<Tab>('executive');
  const [chatOpen, setChatOpen] = useState(false);
  const hasData = state.records.length > 0;
  const { filter: crossFilter, clearFilter } = useCrossFilter();

  // ── URL state sync ───────────────────────────────────────────────────────
  // We hydrate from the query string on first paint (if any), then keep the
  // URL in sync with the current filter state so deep links / refreshes
  // preserve the user's context. We guard against re-applying our own writes
  // by tracking `hydrated`.
  //
  // These hooks must stay ABOVE any early returns so the hook order is
  // stable across renders (rules-of-hooks).
  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    const sp = new URLSearchParams(window.location.search);
    if ([...sp.keys()].length > 0) {
      const p = searchParamsToPayload(sp);
      if (p.activeTab) setActiveTab(p.activeTab as Tab);
      if (p.dateFrom && p.dateTo) {
        dispatch({ type: 'SET_DATE_RANGE', from: p.dateFrom, to: p.dateTo });
      }
      if (p.comparisonFrom && p.comparisonTo) {
        dispatch({ type: 'SET_COMPARISON_RANGE', from: p.comparisonFrom, to: p.comparisonTo });
      }
      if (p.analysisLevel) dispatch({ type: 'SET_ANALYSIS_LEVEL', level: p.analysisLevel });
      if (p.searchQuery) dispatch({ type: 'SET_SEARCH_QUERY', query: p.searchQuery });
      if (typeof p.includeInactive === 'boolean') {
        dispatch({ type: 'SET_INCLUDE_INACTIVE', value: p.includeInactive });
      }
      if (p.selectedGranularity) {
        dispatch({ type: 'SET_GRANULARITY', granularity: p.selectedGranularity });
      }
      if (p.selectedPeriodKey) {
        dispatch({ type: 'SET_SELECTED_PERIOD', periodKey: p.selectedPeriodKey });
      }
      if (p.comparisonPeriodKey) {
        dispatch({ type: 'SET_COMPARISON_PERIOD', periodKey: p.comparisonPeriodKey });
      }
    }
    hydrated.current = true;
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated.current) return;
    const payload: SavedViewPayload = {
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
    };
    const sp = payloadToSearchParams(payload);
    const next = `${window.location.pathname}?${sp.toString()}`;
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [activeTab, state.dateFrom, state.dateTo, state.comparisonFrom, state.comparisonTo,
      state.analysisLevel, state.searchQuery, state.includeInactive,
      state.selectedPeriodKey, state.comparisonPeriodKey, state.selectedGranularity]);

  if (wsLoading) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Carregando workspace"
      >
        <div className="text-muted-foreground text-meta-body">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const handleInsightFilter = (key: string, value: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query: value });
  };

  const applyView = (p: Partial<SavedViewPayload>) => {
    if (p.activeTab) setActiveTab(p.activeTab as Tab);
    if (p.dateFrom && p.dateTo) {
      dispatch({ type: 'SET_DATE_RANGE', from: p.dateFrom, to: p.dateTo });
    }
    if (p.comparisonFrom && p.comparisonTo) {
      dispatch({ type: 'SET_COMPARISON_RANGE', from: p.comparisonFrom, to: p.comparisonTo });
    }
    if (p.analysisLevel) dispatch({ type: 'SET_ANALYSIS_LEVEL', level: p.analysisLevel });
    if (p.searchQuery !== undefined) dispatch({ type: 'SET_SEARCH_QUERY', query: p.searchQuery });
    if (typeof p.includeInactive === 'boolean') {
      dispatch({ type: 'SET_INCLUDE_INACTIVE', value: p.includeInactive });
    }
    if (p.selectedGranularity) {
      dispatch({ type: 'SET_GRANULARITY', granularity: p.selectedGranularity });
    }
    if (p.selectedPeriodKey) {
      dispatch({ type: 'SET_SELECTED_PERIOD', periodKey: p.selectedPeriodKey });
    }
    if (p.comparisonPeriodKey) {
      dispatch({ type: 'SET_COMPARISON_PERIOD', periodKey: p.comparisonPeriodKey });
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Meta-style dual topbar */}
          <MetaTopbar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Filter bar */}
          <CommandHeader />

          <main className="flex-1 p-4 overflow-y-auto bg-background">
            <div className="mb-3 flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {crossFilter.key && (
                  <Badge variant="secondary" className="text-meta-caption flex items-center gap-1.5 px-2.5 py-1 rounded-meta-pill border border-border">
                    Filtrando: <span className="font-semibold">{crossFilter.name}</span>
                    <button
                      onClick={clearFilter}
                      aria-label={`Limpar filtro ${crossFilter.name}`}
                      className="ml-1 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </Badge>
                )}
              </div>
              {hasData && <SavedViewsMenu activeTab={activeTab} onApplyView={applyView} />}
            </div>
            {!hasData && activeTab === 'executive' && <EmptyState />}

            <AnimatePresence mode="wait">
              {activeTab === 'executive' && hasData && (
                <ViewContainer key="executive" label="Executivo">
                  <AlertsBanner />
                  <ExecutiveView />
                  <PacingCard />
                </ViewContainer>
              )}

              {activeTab === 'tactical' && hasData && (
                <ViewContainer key="tactical" label="Tático">
                  <AlertsBanner />
                  <TargetsEditor />
                  <OverviewCards />
                  <ActionCenter />
                  <ActionPanel />
                  <InsightCards onFilterTable={handleInsightFilter} />
                  <AdComparisonSelector />
                  <ComparisonCards />
                  <HeatmapTable />
                </ViewContainer>
              )}

              {activeTab === 'diagnostic' && hasData && (
                <ViewContainer key="diagnostic" label="Diagnóstico">
                  <AdvancedCharts />
                  <OverviewCharts />
                </ViewContainer>
              )}

              {(activeTab === 'tactical' || activeTab === 'diagnostic' || activeTab === 'simulator' || activeTab === 'creatives') && !hasData && (
                <ViewContainer key="nodata">
                  <div className="text-center py-20 space-y-4 bg-card border border-border rounded-meta-card">
                    <BarChart3 className="h-16 w-16 text-muted-foreground/20 mx-auto" strokeWidth={1.5} />
                    <p className="text-meta-heading-sm text-foreground">Dados não disponíveis</p>
                    <p className="text-meta-body text-muted-foreground">Sincronize com o Meta para carregar os dados</p>
                    <MetaSyncButton />
                  </div>
                </ViewContainer>
              )}

              {activeTab === 'funnel' && (
                <ViewContainer key="funnel" label="Funil"><FunnelView /></ViewContainer>
              )}
              {activeTab === 'funnel-real' && (
                <ViewContainer key="funnel-real" label="Funil Real"><FunnelRealView /></ViewContainer>
              )}
              {activeTab === 'leads' && (
                <ViewContainer key="leads" label="Lead Ads"><LeadsView /></ViewContainer>
              )}
              {activeTab === 'instagram' && (
                <ViewContainer key="instagram" label="Instagram"><InstagramView /></ViewContainer>
              )}
              {activeTab === 'creatives' && hasData && (
                <ViewContainer key="creatives" label="Criativos"><CreativesView /></ViewContainer>
              )}
              {activeTab === 'simulator' && hasData && (
                <ViewContainer key="simulator" label="Simulador"><BudgetSimulator /></ViewContainer>
              )}
              {activeTab === 'report' && (
                <ViewContainer key="report" label="Relatório"><ReportView /></ViewContainer>
              )}
              {activeTab === 'decisions' && (
                <ViewContainer key="decisions" label="Decisões"><DecisionsModule /></ViewContainer>
              )}
              {activeTab === 'experiments' && (
                <ViewContainer key="experiments" label="Experimentos"><ExperimentsView /></ViewContainer>
              )}
              {activeTab === 'ab-test' && (
                <ViewContainer key="ab-test" label="A/B Test"><ABTestAnalyzer /></ViewContainer>
              )}
              {activeTab === 'anomalies' && (
                <ViewContainer key="anomalies" label="Anomalias"><AnomalyDetectionView /></ViewContainer>
              )}
              {activeTab === 'forecast' && (
                <ViewContainer key="forecast" label="Forecast"><ForecastView /></ViewContainer>
              )}
              {activeTab === 'utm-builder' && (
                <ViewContainer key="utm-builder" label="UTM Builder"><UtmBuilderView /></ViewContainer>
              )}
              {activeTab === 'benchmarks' && (
                <ViewContainer key="benchmarks" label="Benchmarks"><BenchmarksView /></ViewContainer>
              )}
              {activeTab === 'health' && (
                <ViewContainer key="health" label="Saúde"><DataHealthView /></ViewContainer>
              )}
              {activeTab === 'missing' && (
                <ViewContainer key="missing" label="Lacunas"><MissingDataPanel /></ViewContainer>
              )}
              {activeTab === 'alerts' && (
                <ViewContainer key="alerts" label="Alertas"><AlertsView /></ViewContainer>
              )}
              {activeTab === 'actions' && (
                <ViewContainer key="actions" label="Ações"><ActionCenter /></ViewContainer>
              )}
              {activeTab === 'ai' && (
                <ViewContainer key="ai" label="IA Analyst"><AIRecommendationsPanel /></ViewContainer>
              )}
              {activeTab === 'personas' && (
                <ViewContainer key="personas" label="Personas"><PersonaAudienceView /></ViewContainer>
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* Floating AI Chat Button */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            aria-label="Abrir assistente de IA"
            title="Abrir assistente de IA (ou pressione Cmd+K)"
            className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-meta-card hover:shadow-meta-modal flex items-center justify-center transition-all meta-button-press focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Bot className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}

        <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
        <CommandPalette activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <OnboardingTour />
    </SidebarProvider>
  );
}

const Index = () => (
  <AppProvider>
    <CrossFilterProvider>
      <DashboardContent />
    </CrossFilterProvider>
  </AppProvider>
);

export default Index;
