import { useMemo } from 'react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import {
  aggregateMetrics,
  filterByDateRange,
} from '@/lib/calculations';
import { VERTICALS, DEFAULT_VERTICAL } from '@/lib/benchmarks';
import { AlertTriangle, Bell, X } from 'lucide-react';
import { useState } from 'react';

interface Alert {
  id: string;
  message: string;
  severity: 'critical' | 'warning';
}

export default function AlertsBanner() {
  const { state } = useAppState();
  const { current } = useFilteredRecords();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts = useMemo((): Alert[] => {
    if (current.length === 0) return [];

    const metrics = aggregateMetrics(current);
    const benchmarks = VERTICALS[DEFAULT_VERTICAL];
    const result: Alert[] = [];

    // CPA above target — find matching target
    const targets = state.targets.find(t => t.period_key === state.dateFrom);
    if (targets?.cost_per_result && metrics.cost_per_result > targets.cost_per_result * 1.2) {
      result.push({
        id: 'cpa-above-target',
        message: `CPA (R$${metrics.cost_per_result.toFixed(2)}) está 20%+ acima da meta (R$${targets.cost_per_result.toFixed(2)})`,
        severity: 'critical',
      });
    }

    if (metrics.frequency > benchmarks.frequency_max) {
      result.push({
        id: 'freq-critical',
        message: `Frequência em ${metrics.frequency.toFixed(1)} — acima do limite de ${benchmarks.frequency_max} para ${benchmarks.label}`,
        severity: 'critical',
      });
    }

    if (metrics.ctr_link < benchmarks.ctr_link * 0.7 && metrics.impressions > 1000) {
      result.push({
        id: 'ctr-below',
        message: `CTR Link (${metrics.ctr_link.toFixed(2)}%) está muito abaixo do benchmark (${benchmarks.ctr_link}%)`,
        severity: 'warning',
      });
    }

    if (metrics.cpm > benchmarks.cpm * 1.5) {
      result.push({
        id: 'cpm-high',
        message: `CPM (R$${metrics.cpm.toFixed(2)}) está 50%+ acima do benchmark (R$${benchmarks.cpm})`,
        severity: 'warning',
      });
    }

    if (metrics.lpv_rate < benchmarks.lpv_rate * 0.7 && metrics.link_clicks > 50) {
      result.push({
        id: 'lpv-low',
        message: `LPV Rate (${(metrics.lpv_rate * 100).toFixed(0)}%) abaixo do benchmark (${(benchmarks.lpv_rate * 100).toFixed(0)}%)`,
        severity: 'warning',
      });
    }

    return result;
  }, [current, state.targets, state.dateFrom]);

  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map(alert => (
        <div
          key={alert.id}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
            alert.severity === 'critical'
              ? 'bg-negative/10 border-negative/30 text-negative'
              : 'bg-warning/10 border-warning/30 text-warning'
          }`}
        >
          {alert.severity === 'critical' ? (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <Bell className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="text-xs font-medium flex-1">{alert.message}</span>
          <button
            onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
