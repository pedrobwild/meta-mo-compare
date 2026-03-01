import { useState } from 'react';
import { Cloud, BarChart3, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppProvider, useAppState } from '@/lib/store';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar, type Tab } from '@/components/AppSidebar';
import CommandHeader from '@/components/CommandHeader';
import GlobalFilters from '@/components/GlobalFilters';
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
import ActionPanel from '@/components/ActionPanel';
import ExecutiveView from '@/components/ExecutiveView';
import MissingDataPanel from '@/components/MissingDataPanel';
import PacingCard from '@/components/PacingCard';
import AlertsBanner from '@/components/AlertsBanner';
import BudgetSimulator from '@/components/BudgetSimulator';
import DecisionLog from '@/components/DecisionLog';
import MetaSyncButton from '@/components/MetaSyncButton';
import OnboardingTour from '@/components/OnboardingTour';

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center space-y-8 max-w-lg mx-auto px-4"
      >
        <div className="relative">
          <div className="h-24 w-24 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center glow-primary">
            <Cloud className="h-12 w-12 text-primary" />
          </div>
          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary/40 animate-pulse" />
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Meta Ads <span className="text-gradient-primary">Command Center</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Conecte seus dados do Meta Ads para desbloquear análises de performance em tempo real, alertas inteligentes e projeções avançadas.
          </p>
        </div>
        <MetaSyncButton />
        <div className="flex items-center justify-center gap-6 text-[10px] text-muted-foreground/50 uppercase tracking-widest">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3 w-3" /> Alertas em tempo real
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" /> Análise profunda
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
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {children}
    </motion.div>
  );
}

function DashboardContent() {
  const { state, dispatch } = useAppState();
  const [activeTab, setActiveTab] = useState<Tab>('executive');
  const hasData = state.records.length > 0;

  const handleInsightFilter = (key: string, value: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query: value });
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="flex-1 flex flex-col min-w-0">
          <CommandHeader />

          <main className="flex-1 p-4 overflow-y-auto">
            {!hasData && <EmptyState />}

            <AnimatePresence mode="wait">
              {/* EXECUTIVE VIEW */}
              {activeTab === 'executive' && hasData && (
                <ViewContainer key="executive">
                  <AlertsBanner />
                  <ExecutiveView />
                  <PacingCard />
                </ViewContainer>
              )}

              {/* TACTICAL VIEW */}
              {activeTab === 'tactical' && hasData && (
                <ViewContainer key="tactical">
                  <AlertsBanner />
                  <TargetsEditor />
                  <OverviewCards />
                  <ActionPanel />
                  <InsightCards onFilterTable={handleInsightFilter} />
                  <ComparisonCards />
                  <HeatmapTable />
                </ViewContainer>
              )}

              {/* DIAGNOSTIC VIEW */}
              {activeTab === 'diagnostic' && hasData && (
                <ViewContainer key="diagnostic">
                  <AdvancedCharts />
                  <OverviewCharts />
                </ViewContainer>
              )}

              {/* No data states for analysis tabs */}
              {(activeTab === 'tactical' || activeTab === 'diagnostic' || activeTab === 'simulator') && !hasData && (
                <ViewContainer key="nodata">
                  <div className="text-center py-20 space-y-4">
                    <BarChart3 className="h-16 w-16 text-muted-foreground/20 mx-auto" />
                    <p className="text-sm text-muted-foreground">Sincronize dados para acessar esta visualização</p>
                    <MetaSyncButton />
                  </div>
                </ViewContainer>
              )}

              {activeTab === 'funnel' && (
                <ViewContainer key="funnel"><FunnelView /></ViewContainer>
              )}
              {activeTab === 'simulator' && hasData && (
                <ViewContainer key="simulator"><BudgetSimulator /></ViewContainer>
              )}
              {activeTab === 'report' && (
                <ViewContainer key="report"><ReportView /></ViewContainer>
              )}
              {activeTab === 'decisions' && (
                <ViewContainer key="decisions"><DecisionLog /></ViewContainer>
              )}
              {activeTab === 'health' && (
                <ViewContainer key="health"><DataHealthView /></ViewContainer>
              )}
              {activeTab === 'missing' && (
                <ViewContainer key="missing"><MissingDataPanel /></ViewContainer>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>
      <OnboardingTour />
    </SidebarProvider>
  );
}

const Index = () => (
  <AppProvider>
    <DashboardContent />
  </AppProvider>
);

export default Index;
