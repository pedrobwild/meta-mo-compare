import { useState } from 'react';
import { BarChart3, Upload, FileText, Activity, GitBranch, Trash2, Lightbulb, Eye, Crosshair, ChartScatter, History, Calculator } from 'lucide-react';
import { AppProvider, useAppState } from '@/lib/store';
import FileUploadComponent from '@/components/FileUpload';
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
import ThemeToggle from '@/components/ThemeToggle';
import OnboardingTour from '@/components/OnboardingTour';
import { Button } from '@/components/ui/button';

type Tab = 'executive' | 'tactical' | 'diagnostic' | 'upload' | 'funnel' | 'report' | 'health' | 'missing' | 'decisions' | 'simulator';

const TABS: { key: Tab; label: string; icon: React.ReactNode; group?: string }[] = [
  { key: 'executive', label: 'Executivo', icon: <Eye className="h-4 w-4" />, group: 'análise' },
  { key: 'tactical', label: 'Tático', icon: <Crosshair className="h-4 w-4" />, group: 'análise' },
  { key: 'diagnostic', label: 'Diagnóstico', icon: <ChartScatter className="h-4 w-4" />, group: 'análise' },
  { key: 'upload', label: 'Importar', icon: <Upload className="h-4 w-4" />, group: 'dados' },
  { key: 'funnel', label: 'Funil', icon: <Activity className="h-4 w-4" />, group: 'dados' },
  { key: 'simulator', label: 'Simulador', icon: <Calculator className="h-4 w-4" />, group: 'dados' },
  { key: 'report', label: 'Relatório', icon: <FileText className="h-4 w-4" />, group: 'output' },
  { key: 'decisions', label: 'Decisões', icon: <History className="h-4 w-4" />, group: 'output' },
  { key: 'health', label: 'Saúde', icon: <GitBranch className="h-4 w-4" />, group: 'config' },
  { key: 'missing', label: 'Dados', icon: <Lightbulb className="h-4 w-4" />, group: 'config' },
];

function DashboardContent() {
  const { state, dispatch } = useAppState();
  const [activeTab, setActiveTab] = useState<Tab>(state.records.length > 0 ? 'executive' : 'upload');
  const hasData = state.records.length > 0;

  const handleInsightFilter = (key: string, value: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query: value });
  };

  return (
    <div className="min-h-screen bg-background">
      <OnboardingTour />
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight">Meta Ads Analyzer</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Dashboard de Performance</p>
            </div>
          </div>

          <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            {TABS.map((tab, i) => {
              const prevGroup = i > 0 ? TABS[i - 1].group : null;
              const showSep = prevGroup && prevGroup !== tab.group;
              return (
                <div key={tab.key} className="flex items-center">
                  {showSep && <div className="w-px h-5 bg-border mx-1 hidden sm:block" />}
                  <button
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap
                      ${activeTab === tab.key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                  >
                    {tab.icon}
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                </div>
              );
            })}
            <div className="w-px h-5 bg-border mx-1" />
            <ThemeToggle />
            {hasData && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => dispatch({ type: 'CLEAR_ALL' })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <FileUploadComponent />
            {hasData && (
              <p className="text-center text-sm text-muted-foreground">
                {state.records.length} registros • {[...new Set(state.records.map(r => r.period_key))].length} períodos
              </p>
            )}
          </div>
        )}

        {/* EXECUTIVE VIEW */}
        {activeTab === 'executive' && hasData && (
          <>
            <GlobalFilters />
            <AlertsBanner />
            <ExecutiveView />
            <PacingCard />
          </>
        )}

        {/* TACTICAL VIEW */}
        {activeTab === 'tactical' && hasData && (
          <>
            <GlobalFilters />
            <AlertsBanner />
            <TargetsEditor />
            <OverviewCards />
            <ActionPanel />
            <InsightCards onFilterTable={handleInsightFilter} />
            <ComparisonCards />
            <HeatmapTable />
          </>
        )}

        {/* DIAGNOSTIC VIEW */}
        {activeTab === 'diagnostic' && hasData && (
          <>
            <GlobalFilters />
            <AdvancedCharts />
            <OverviewCharts />
          </>
        )}

        {/* No data states */}
        {(activeTab === 'executive' || activeTab === 'tactical' || activeTab === 'diagnostic') && !hasData && (
          <div className="text-center py-20 space-y-4">
            <BarChart3 className="h-16 w-16 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">Importe relatórios do Meta Ads para começar</p>
            <Button variant="outline" onClick={() => setActiveTab('upload')}>
              <Upload className="h-4 w-4 mr-2" /> Importar Dados
            </Button>
          </div>
        )}

        {activeTab === 'funnel' && <FunnelView />}
        {activeTab === 'simulator' && hasData && (
          <>
            <GlobalFilters />
            <BudgetSimulator />
          </>
        )}
        {activeTab === 'report' && <ReportView />}
        {activeTab === 'decisions' && <DecisionLog />}
        {activeTab === 'health' && <DataHealthView />}
        {activeTab === 'missing' && <MissingDataPanel />}
      </main>
    </div>
  );
}

const Index = () => (
  <AppProvider>
    <DashboardContent />
  </AppProvider>
);

export default Index;
