import {
  Eye, Crosshair, ChartScatter, Activity, Calculator, FileText,
  History, GitBranch, Lightbulb, BarChart3, Bell, Zap, Bot, LogOut,
  Users, Palette, Contact, Instagram, FlaskConical, Link2, Gauge, Search
} from 'lucide-react';
import { useAppState } from '@/lib/store';
import { useWorkspace } from '@/lib/workspace';
import MetaSyncButton from './MetaSyncButton';
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

export type Tab = 'executive' | 'tactical' | 'diagnostic' | 'funnel' | 'funnel-real' | 'leads' | 'instagram' | 'creatives' | 'simulator' | 'report' | 'decisions' | 'experiments' | 'utm-builder' | 'benchmarks' | 'health' | 'missing' | 'alerts' | 'actions' | 'ai';

const NAV_GROUPS = [
  {
    label: 'ANÁLISE',
    items: [
      { key: 'executive' as Tab, label: 'Executivo', icon: BarChart3 },
      { key: 'tactical' as Tab, label: 'Tático', icon: Crosshair },
      { key: 'diagnostic' as Tab, label: 'Diagnóstico', icon: Search },
      { key: 'creatives' as Tab, label: 'Criativos', icon: Palette },
      { key: 'alerts' as Tab, label: 'Alertas', icon: Bell },
      { key: 'actions' as Tab, label: 'Ações', icon: Zap },
      { key: 'ai' as Tab, label: 'IA Analyst', icon: Bot },
    ],
  },
  {
    label: 'DADOS',
    items: [
      { key: 'funnel' as Tab, label: 'Funil', icon: Activity },
      { key: 'funnel-real' as Tab, label: 'Funil Real', icon: Users },
      { key: 'leads' as Tab, label: 'Lead Ads', icon: Contact },
      { key: 'instagram' as Tab, label: 'Instagram', icon: Instagram },
    ],
  },
  {
    label: 'CONFIGURAÇÃO',
    items: [
      { key: 'utm-builder' as Tab, label: 'UTM Builder', icon: Link2 },
      { key: 'simulator' as Tab, label: 'Simulador', icon: Calculator },
      { key: 'report' as Tab, label: 'Relatório', icon: FileText },
      { key: 'decisions' as Tab, label: 'Decisões', icon: History },
      { key: 'experiments' as Tab, label: 'Experimentos', icon: FlaskConical },
      { key: 'benchmarks' as Tab, label: 'Benchmarks', icon: Gauge },
      { key: 'health' as Tab, label: 'Saúde', icon: GitBranch },
      { key: 'missing' as Tab, label: 'Lacunas', icon: Lightbulb },
    ],
  },
];

interface AppSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { state } = useAppState();
  const { state: sidebarState } = useSidebar();
  const { user, workspace, signOut } = useWorkspace();
  const collapsed = sidebarState === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-3 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-meta-card bg-primary flex items-center justify-center flex-shrink-0">
            <BarChart3 className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-meta-heading-sm text-foreground tracking-tight truncate">Meta Ads</h1>
              <p className="text-meta-caption text-muted-foreground truncate">Command Center</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <Separator className="bg-sidebar-border" />

      <SidebarContent className="px-2 py-1.5">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="meta-section-label px-3 mb-0.5">
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
                          rounded-meta-btn transition-colors duration-100 h-9
                          ${isActive
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-sidebar-foreground hover:bg-secondary'
                          }
                        `}
                      >
                        <item.icon
                          className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                          strokeWidth={1.5}
                        />
                        {!collapsed && (
                          <span className="text-meta-body truncate">{item.label}</span>
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

      <SidebarFooter className="p-2">
        <Separator className="bg-sidebar-border mb-2" />
        {!collapsed && user && (
          <div className="px-2 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-meta-caption font-semibold flex-shrink-0">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-meta-caption text-foreground font-medium truncate">
                  {user.email?.split('@')[0]}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full text-meta-caption text-muted-foreground justify-start px-2 hover:bg-secondary hover:text-foreground rounded-meta-btn"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5 mr-2" strokeWidth={1.5} /> Sair
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
