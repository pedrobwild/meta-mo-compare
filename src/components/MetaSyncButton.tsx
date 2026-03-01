import { useState } from 'react';
import { RefreshCw, Cloud, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAppState } from '@/lib/store';
import { loadRecords } from '@/lib/persistence';

export default function MetaSyncButton() {
  const { dispatch } = useAppState();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const handleSync = async (datePreset = 'last_30d') => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-meta-ads', {
        body: { date_preset: datePreset },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro desconhecido');

      // Reload records from database
      const records = await loadRecords();
      const { loadTargets, loadFunnelData } = await import('@/lib/persistence');
      const [targets, funnelData] = await Promise.all([loadTargets(), loadFunnelData()]);
      dispatch({ type: 'HYDRATE', records, targets, funnelData });

      setLastSync(new Date().toLocaleTimeString('pt-BR'));
      toast.success(`${data.records} registros sincronizados do Meta Ads`);
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error(`Erro na sincronização: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => handleSync('last_30d')}
          disabled={syncing}
          className="gap-2"
          variant="default"
        >
          {syncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4" />
          )}
          {syncing ? 'Sincronizando...' : 'Sincronizar Meta Ads'}
        </Button>
        <Button
          onClick={() => handleSync('last_7d')}
          disabled={syncing}
          variant="outline"
          size="sm"
        >
          Últimos 7 dias
        </Button>
        <Button
          onClick={() => handleSync('last_90d')}
          disabled={syncing}
          variant="outline"
          size="sm"
        >
          Últimos 90 dias
        </Button>
      </div>
      {lastSync && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-positive" />
          Última sincronização: {lastSync}
        </p>
      )}
    </div>
  );
}
