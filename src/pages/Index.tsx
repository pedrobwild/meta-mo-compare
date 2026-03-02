import { useState } from 'react';
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

function ViewContainer({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {children}
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

  if (wsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
            {crossFilter.key && (
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-meta-caption flex items-center gap-1.5 px-2.5 py-1 rounded-meta-pill border border-border">
                  Filtrando: <span className="font-semibold">{crossFilter.name}</span>
                  <button onClick={clearFilter} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                </Badge>
              </div>
            )}
            {!hasData && activeTab === 'executive' && <EmptyState />}

            <AnimatePresence mode="wait">
              {activeTab === 'executive' && hasData && (
                <ViewContainer key="executive">
                  <AlertsBanner />
                  <ExecutiveView />
                  <PacingCard />
                </ViewContainer>
              )}

              {activeTab === 'tactical' && hasData && (
                <ViewContainer key="tactical">
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
                <ViewContainer key="diagnostic">
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
                <ViewContainer key="funnel"><FunnelView /></ViewContainer>
              )}
              {activeTab === 'funnel-real' && (
                <ViewContainer key="funnel-real"><FunnelRealView /></ViewContainer>
              )}
              {activeTab === 'leads' && (
                <ViewContainer key="leads"><LeadsView /></ViewContainer>
              )}
              {activeTab === 'instagram' && (
                <ViewContainer key="instagram"><InstagramView /></ViewContainer>
              )}
              {activeTab === 'creatives' && hasData && (
                <ViewContainer key="creatives"><CreativesView /></ViewContainer>
              )}
              {activeTab === 'simulator' && hasData && (
                <ViewContainer key="simulator"><BudgetSimulator /></ViewContainer>
              )}
              {activeTab === 'report' && (
                <ViewContainer key="report"><ReportView /></ViewContainer>
              )}
              {activeTab === 'decisions' && (
                <ViewContainer key="decisions"><DecisionsModule /></ViewContainer>
              )}
              {activeTab === 'experiments' && (
                <ViewContainer key="experiments"><ExperimentsView /></ViewContainer>
              )}
              {activeTab === 'utm-builder' && (
                <ViewContainer key="utm-builder"><UtmBuilderView /></ViewContainer>
              )}
              {activeTab === 'benchmarks' && (
                <ViewContainer key="benchmarks"><BenchmarksView /></ViewContainer>
              )}
              {activeTab === 'health' && (
                <ViewContainer key="health"><DataHealthView /></ViewContainer>
              )}
              {activeTab === 'missing' && (
                <ViewContainer key="missing"><MissingDataPanel /></ViewContainer>
              )}
              {activeTab === 'alerts' && (
                <ViewContainer key="alerts"><AlertsView /></ViewContainer>
              )}
              {activeTab === 'actions' && (
                <ViewContainer key="actions"><ActionCenter /></ViewContainer>
              )}
              {activeTab === 'ai' && (
                <ViewContainer key="ai"><AIRecommendationsPanel /></ViewContainer>
              )}
              {activeTab === 'personas' && (
                <ViewContainer key="personas"><PersonaAudienceView /></ViewContainer>
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* Floating AI Chat Button */}
        {!chatOpen && (
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-meta-card hover:shadow-meta-modal flex items-center justify-center transition-all meta-button-press"
          >
            <Bot className="h-5 w-5" strokeWidth={1.5} />
          </button>
        )}

        <AIChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
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
