import { useState } from 'react';
import { RefreshCw, Cloud, CheckCircle2 } from 'lucide-react';
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

      const records = await loadRecords();
      const { loadTargets, loadFunnelData } = await import('@/lib/persistence');
      const [targets, funnelData] = await Promise.all([loadTargets(), loadFunnelData()]);
      dispatch({ type: 'HYDRATE', records, targets, funnelData });

      setLastSync(new Date().toLocaleTimeString('pt-BR'));
      toast.success(`${data.records} registros sincronizados`);
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error(`Erro: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => handleSync('last_30d')}
          disabled={syncing}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium glow-primary"
          size="lg"
        >
          {syncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4" />
          )}
          {syncing ? 'Sincronizando...' : 'Sincronizar Meta Ads'}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => handleSync('last_7d')} disabled={syncing} variant="outline" size="sm" className="text-xs font-mono h-7 bg-surface-2/50 border-border">
          7 dias
        </Button>
        <Button onClick={() => handleSync('last_90d')} disabled={syncing} variant="outline" size="sm" className="text-xs font-mono h-7 bg-surface-2/50 border-border">
          90 dias
        </Button>
      </div>
      {lastSync && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-positive" />
          Sincronizado: {lastSync}
        </p>
      )}
    </div>
  );
}
