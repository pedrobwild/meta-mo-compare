import GlobalFilters from './GlobalFilters';
import MetaSyncButton from './MetaSyncButton';
import { useAppState } from '@/lib/store';
import { RefreshCw } from 'lucide-react';

export default function CommandHeader() {
  const { state } = useAppState();
  const hasData = state.records.length > 0;

  return (
    <div className="bg-card border-b border-border px-4 py-2.5">
      {hasData ? (
        <div className="overflow-x-auto scrollbar-none">
          <GlobalFilters />
        </div>
      ) : (
        <div className="flex items-center gap-2 text-meta-body text-muted-foreground py-1">
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Sincronize dados para começar</span>
          <div className="ml-auto">
            <MetaSyncButton />
          </div>
        </div>
      )}
    </div>
  );
}
