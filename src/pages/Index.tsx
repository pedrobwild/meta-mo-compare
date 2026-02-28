import { useState } from 'react';
import { BarChart3, Upload, FileText, Activity, Target, GitBranch, Trash2 } from 'lucide-react';
import { AppProvider, useAppState } from '@/lib/store';
import FileUploadComponent from '@/components/FileUpload';
import GlobalFilters from '@/components/GlobalFilters';
import OverviewCards from '@/components/OverviewCards';
import RankingTable from '@/components/RankingTable';
import OverviewCharts from '@/components/OverviewCharts';
import FunnelView from '@/components/FunnelView';
import ReportView from '@/components/ReportView';
import DataHealthView from '@/components/DataHealthView';
import TargetsEditor from '@/components/TargetsEditor';
import { Button } from '@/components/ui/button';

type Tab = 'overview' | 'upload' | 'funnel' | 'report' | 'health';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'upload', label: 'Importar', icon: <Upload className="h-4 w-4" /> },
  { key: 'funnel', label: 'Funil', icon: <Activity className="h-4 w-4" /> },
  { key: 'report', label: 'Relatório', icon: <FileText className="h-4 w-4" /> },
  { key: 'health', label: 'Saúde', icon: <GitBranch className="h-4 w-4" /> },
];

function DashboardContent() {
  const { state, dispatch } = useAppState();
  const [activeTab, setActiveTab] = useState<Tab>(state.records.length > 0 ? 'overview' : 'upload');
  const hasData = state.records.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-tight">Meta Ads Analyzer</h1>
              <p className="text-[11px] text-muted-foreground">Análise MoM de Tráfego Pago</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${activeTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
            {hasData && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 text-muted-foreground hover:text-destructive"
                onClick={() => dispatch({ type: 'CLEAR_ALL' })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        {activeTab === 'upload' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <FileUploadComponent />
            {hasData && (
              <p className="text-center text-sm text-muted-foreground">
                {state.records.length} registros carregados • {[...new Set(state.records.map(r => r.month_key))].length} meses
              </p>
            )}
          </div>
        )}

        {activeTab === 'overview' && hasData && (
          <>
            <GlobalFilters />
            <TargetsEditor />
            <OverviewCards />
            <OverviewCharts />
            <RankingTable />
          </>
        )}

        {activeTab === 'overview' && !hasData && (
          <div className="text-center py-20 space-y-4">
            <BarChart3 className="h-16 w-16 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">Importe relatórios do Meta Ads para começar</p>
            <Button variant="outline" onClick={() => setActiveTab('upload')}>
              <Upload className="h-4 w-4 mr-2" /> Importar Dados
            </Button>
          </div>
        )}

        {activeTab === 'funnel' && <FunnelView />}
        {activeTab === 'report' && <ReportView />}
        {activeTab === 'health' && <DataHealthView />}
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
