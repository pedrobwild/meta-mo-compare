import { Eye, Crosshair, ChartScatter, Activity, Calculator, FileText, History, GitBranch, Lightbulb, Cloud, RefreshCw, Trash2, BarChart3, Bell, Zap, Bot, LogOut, Users, Palette, Contact, Instagram, FlaskConical, Link2 } from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useWorkspace } from '@/lib/workspace';
import MetaSyncButton from './MetaSyncButton';
import ThemeToggle from './ThemeToggle';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export type Tab = 'executive' | 'tactical' | 'diagnostic' | 'funnel' | 'funnel-real' | 'leads' | 'instagram' | 'creatives' | 'simulator' | 'report' | 'decisions' | 'experiments' | 'utm-builder' | 'health' | 'missing' | 'alerts' | 'actions' | 'ai';

const NAV_GROUPS = [
  {
    label: 'Análise',
    items: [
      { key: 'executive' as Tab, label: 'Executivo', icon: Eye, description: 'Visão geral e semáforos' },
      { key: 'tactical' as Tab, label: 'Tático', icon: Crosshair, description: 'KPIs, insights e ações' },
      { key: 'diagnostic' as Tab, label: 'Diagnóstico', icon: ChartScatter, description: 'Gráficos avançados' },
      { key: 'creatives' as Tab, label: 'Criativos', icon: Palette, description: 'Ciclo de vida de anúncios' },
      { key: 'alerts' as Tab, label: 'Alertas', icon: Bell, description: 'Regras e eventos' },
      { key: 'actions' as Tab, label: 'Ações', icon: Zap, description: 'Recomendações' },
      { key: 'ai' as Tab, label: 'IA Analyst', icon: Bot, description: 'Chat e recomendações IA' },
    ],
  },
  {
    label: 'Dados',
    items: [
      { key: 'funnel' as Tab, label: 'Funil', icon: Activity, description: 'Dados de CRM' },
      { key: 'funnel-real' as Tab, label: 'Funil Real', icon: Users, description: 'Qualidade de leads' },
      { key: 'leads' as Tab, label: 'Lead Ads', icon: Contact, description: 'Leads capturados' },
      { key: 'instagram' as Tab, label: 'Instagram', icon: Instagram, description: 'Posts, métricas e DMs' },
      { key: 'simulator' as Tab, label: 'Simulador', icon: Calculator, description: 'Projeções de budget' },
    ],
  },
  {
    label: 'Output',
    items: [
      { key: 'report' as Tab, label: 'Relatório', icon: FileText, description: 'Exportar PDF' },
      { key: 'decisions' as Tab, label: 'Decisões', icon: History, description: 'Log de otimizações' },
      { key: 'experiments' as Tab, label: 'Experimentos', icon: FlaskConical, description: 'A/B tests e hipóteses' },
      { key: 'utm-builder' as Tab, label: 'UTM Builder', icon: Link2, description: 'Gerador de UTMs bwild' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { key: 'health' as Tab, label: 'Saúde', icon: GitBranch, description: 'Integridade dos dados' },
      { key: 'missing' as Tab, label: 'Lacunas', icon: Lightbulb, description: 'Dados ausentes' },
    ],
  },
];

interface AppSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { state, dispatch } = useAppState();
  const { state: sidebarState } = useSidebar();
  const { user, workspace, signOut } = useWorkspace();
  const collapsed = sidebarState === 'collapsed';
  const hasData = state.records.length > 0;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 border border-primary/20">
            <BarChart3 className="h-4.5 w-4.5 text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground tracking-tight truncate">Meta Ads</h1>
              <p className="text-[10px] text-muted-foreground truncate">Command Center</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Separator className="bg-sidebar-border" />

      <SidebarContent className="px-2 py-2">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 px-2 mb-1">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = activeTab === item.key;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        onClick={() => onTabChange(item.key)}
                        tooltip={item.label}
                        className={`
                          group relative rounded-md transition-all duration-200
                          ${isActive
                            ? 'bg-primary/10 text-primary border-glow'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          }
                        `}
                      >
                        <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
                        {!collapsed && (
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium truncate">{item.label}</span>
                          </div>
                        )}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-r" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2 space-y-1">
        <Separator className="bg-sidebar-border mb-1" />
        <div className="flex items-center justify-between px-1">
          <ThemeToggle />
          {hasData && !collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => dispatch({ type: 'CLEAR_ALL' })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {!collapsed && (
          <div className="px-1 py-1 space-y-1">
            {workspace && (
              <div className="text-[10px] text-muted-foreground/70 truncate">{workspace.name}</div>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
              <div className="status-dot-live" />
              <span>Conectado</span>
            </div>
            {user && (
              <Button variant="ghost" size="sm" className="h-6 w-full text-[10px] text-muted-foreground justify-start px-1" onClick={signOut}>
                <LogOut className="h-3 w-3 mr-1" /> Sair
              </Button>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
