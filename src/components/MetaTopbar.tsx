import { useWorkspace } from '@/lib/workspace';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import ThemeToggle from './ThemeToggle';
import type { Tab } from './AppSidebar';

// Facebook SVG icon
function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

const NAV_ITEMS: { key: Tab; label: string }[] = [
  { key: 'executive', label: 'Executivo' },
  { key: 'tactical', label: 'Tático' },
  { key: 'diagnostic', label: 'Diagnóstico' },
  { key: 'creatives', label: 'Criativos' },
  { key: 'alerts', label: 'Alertas' },
  { key: 'actions', label: 'Ações' },
  { key: 'ai', label: 'IA Analyst' },
  { key: 'funnel', label: 'Funil' },
  { key: 'funnel-real', label: 'Funil Real' },
  { key: 'simulator', label: 'Simulador' },
  { key: 'report', label: 'Relatório' },
  { key: 'decisions', label: 'Decisões' },
  { key: 'health', label: 'Saúde' },
];

interface MetaTopbarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function MetaTopbar({ activeTab, onTabChange }: MetaTopbarProps) {
  const { user } = useWorkspace();
  const { state: sidebarState } = useSidebar();
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
  const userName = user?.email?.split('@')[0] || 'Usuário';

  return (
    <div className="sticky top-0 z-50">
      {/* ── Top bar (Facebook blue) ── */}
      <div className="h-10 flex items-center justify-between px-4" style={{ background: 'hsl(var(--meta-header))' }}>
        <div className="flex items-center gap-2.5">
          <SidebarTrigger className="text-white/80 hover:text-white md:hidden" />
          <FacebookIcon />
          <span className="text-white font-bold text-meta-heading-sm tracking-tight hidden sm:inline">
            Meta Ads Command Center
          </span>
          <span className="text-white font-bold text-meta-body sm:hidden">
            Meta Ads
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <span className="text-white/90 text-meta-caption hidden sm:inline">{userName}</span>
            <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-white text-meta-caption font-semibold">
              {userInitial}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation bar ── */}
      <div className="h-11 bg-card border-b border-border flex items-center px-2 overflow-x-auto scrollbar-none">
        {NAV_ITEMS.map(item => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onTabChange(item.key)}
              className={`
                relative h-full px-3.5 text-meta-body whitespace-nowrap transition-colors meta-button-press
                ${isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground font-medium hover:bg-secondary rounded-md'
                }
              `}
            >
              {item.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
