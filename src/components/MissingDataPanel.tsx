import { CheckCircle2, XCircle, Lock, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FeatureStatus {
  name: string;
  description: string;
  available: boolean;
  reason?: string;
  howToUnlock?: string;
}

const FEATURES: FeatureStatus[] = [
  {
    name: 'LPV Rate (Clique bom)',
    description: 'Proporção de cliques que chegam à landing page',
    available: true,
  },
  {
    name: 'Qualified CTR',
    description: 'LPV / Impressões — CTR real qualificado',
    available: true,
  },
  {
    name: 'Triângulo Sagrado',
    description: 'Diagnóstico CPM / CTR / LPV Rate / Cost Result',
    available: true,
  },
  {
    name: 'Fadiga de Audiência',
    description: 'Frequência vs CTR vs Cost/Result',
    available: true,
  },
  {
    name: 'CPC Barato-Lixo',
    description: 'Detecção de cliques não qualificados',
    available: true,
  },
  {
    name: 'Gargalo Pós-Clique',
    description: 'Result/LPV tracking WoW',
    available: true,
  },
  {
    name: 'ROAS / AOV',
    description: 'Retorno sobre investimento e ticket médio',
    available: true,
  },
  {
    name: 'Heatmaps por Placement/Idade/Geo',
    description: 'Breakdown por posicionamento, faixa etária e região',
    available: true,
    howToUnlock: 'Sincronize com breakdowns ativados para ver dados segmentados',
  },
  {
    name: 'Elasticidade +R$1/dia',
    description: 'Curva marginal de spend vs resultado por dia',
    available: true,
    howToUnlock: 'Dados diários já são sincronizados automaticamente',
  },
  {
    name: 'Hook vs Hold (Vídeo)',
    description: 'Análise de retenção de vídeo (hook rate, hold rate)',
    available: false,
    reason: 'API ainda não busca métricas de vídeo (ThruPlay, Video Watches)',
    howToUnlock: 'Em breve: adicionar campos de vídeo à sincronização com o Meta',
  },
];

export default function MissingDataPanel() {
  const available = FEATURES.filter(f => f.available);
  const blocked = FEATURES.filter(f => !f.available);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Unlock className="h-4 w-4 text-positive" />
          Features Disponíveis ({available.length})
        </h3>
        <div className="space-y-2">
          {available.map(f => (
            <div key={f.name} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <CheckCircle2 className="h-4 w-4 text-positive flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
              <Badge variant="default" className="ml-auto text-[10px]">OK</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-negative" />
          Features Bloqueadas ({blocked.length})
        </h3>
        <div className="space-y-3">
          {blocked.map(f => (
            <div key={f.name} className="border border-border rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4 text-negative flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
                <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>
              </div>
              <div className="bg-secondary/50 rounded px-3 py-2 ml-7">
                <p className="text-xs text-negative"><strong>Motivo:</strong> {f.reason}</p>
                <p className="text-xs text-primary mt-1"><strong>Como liberar:</strong> {f.howToUnlock}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
