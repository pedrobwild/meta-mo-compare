import { SidebarTrigger } from '@/components/ui/sidebar';
import GlobalFilters from './GlobalFilters';
import MetaSyncButton from './MetaSyncButton';
import { useAppState } from '@/lib/store';
import { RefreshCw } from 'lucide-react';

export default function CommandHeader() {
  const { state } = useAppState();
  const hasData = state.records.length > 0;

  return (
    <header className="h-12 flex items-center gap-3 px-3 border-b border-border bg-surface-0/80 backdrop-blur-xl sticky top-0 z-50">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="h-5 w-px bg-border" />
      {hasData ? (
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <GlobalFilters />
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Sincronize dados para começar</span>
        </div>
      )}
    </header>
  );
}
