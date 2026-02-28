import { useMemo } from 'react';
import { useAppState } from '@/lib/store';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function DataHealthView() {
  const { state } = useAppState();

  const health = useMemo(() => {
    const ads = new Set<string>();
    const adsWithCampaign = new Set<string>();
    const adsWithAdset = new Set<string>();
    const orphans: { ad: string; hasCampaign: boolean; hasAdset: boolean }[] = [];

    for (const r of state.records) {
      ads.add(r.ad_key);
      if (r.campaign_key) adsWithCampaign.add(r.ad_key);
      if (r.adset_key) adsWithAdset.add(r.ad_key);
    }

    for (const ad of ads) {
      if (!adsWithCampaign.has(ad) || !adsWithAdset.has(ad)) {
        orphans.push({
          ad,
          hasCampaign: adsWithCampaign.has(ad),
          hasAdset: adsWithAdset.has(ad),
        });
      }
    }

    return {
      totalAds: ads.size,
      withCampaign: adsWithCampaign.size,
      withAdset: adsWithAdset.size,
      pctCampaign: ads.size > 0 ? (adsWithCampaign.size / ads.size) * 100 : 0,
      pctAdset: ads.size > 0 ? (adsWithAdset.size / ads.size) * 100 : 0,
      orphans: orphans.slice(0, 20),
    };
  }, [state.records]);

  if (state.records.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Importe dados para ver a saúde do relacionamento</p>;
  }

  const sources = [...new Set(state.records.map(r => r.source_type))];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Anúncios</p>
          <p className="text-2xl font-bold text-foreground">{health.totalAds}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Com Campanha</p>
          <p className="text-2xl font-bold text-foreground">{health.pctCampaign.toFixed(0)}%</p>
          <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-positive rounded-full" style={{ width: `${health.pctCampaign}%` }} />
          </div>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Com Conjunto</p>
          <p className="text-2xl font-bold text-foreground">{health.pctAdset.toFixed(0)}%</p>
          <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-positive rounded-full" style={{ width: `${health.pctAdset}%` }} />
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <p className="text-xs text-muted-foreground mb-2">Fontes importadas</p>
        <div className="flex gap-2 flex-wrap">
          {sources.map(s => (
            <span key={s} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">
              {s === 'type3_full' ? 'Full Hierarchy' : s === 'type2_ad_campaign' ? 'Ad + Campanha' : 'Ad Only'}
            </span>
          ))}
        </div>
      </div>

      {health.orphans.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-medium text-warning mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Anúncios Órfãos ({health.orphans.length})
          </h3>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {health.orphans.map(o => (
              <div key={o.ad} className="flex items-center gap-2 text-sm py-1 border-b border-border/50">
                <span className="text-foreground truncate flex-1">{o.ad}</span>
                {o.hasCampaign ? <CheckCircle2 className="h-3.5 w-3.5 text-positive" /> : <XCircle className="h-3.5 w-3.5 text-negative" />}
                <span className="text-xs text-muted-foreground">Camp</span>
                {o.hasAdset ? <CheckCircle2 className="h-3.5 w-3.5 text-positive" /> : <XCircle className="h-3.5 w-3.5 text-negative" />}
                <span className="text-xs text-muted-foreground">Conj</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {health.orphans.length === 0 && (
        <div className="glass-card p-4 text-center">
          <CheckCircle2 className="h-6 w-6 text-positive mx-auto mb-2" />
          <p className="text-foreground font-medium">Todos os anúncios estão vinculados!</p>
        </div>
      )}
    </div>
  );
}
