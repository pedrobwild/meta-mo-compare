import { useState } from 'react';
import { useAppState } from '@/lib/store';
import { getMonthLabel } from '@/lib/calculations';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Save, Target, ChevronDown } from 'lucide-react';
import type { MonthlyTargets } from '@/lib/types';
import { toast } from 'sonner';

const TARGET_FIELDS: { key: keyof MonthlyTargets; label: string; prefix?: string }[] = [
  { key: 'spend', label: 'Investimento', prefix: 'R$' },
  { key: 'results', label: 'Resultados' },
  { key: 'ctr_link', label: 'CTR Link (%)' },
  { key: 'cpc_link', label: 'CPC Link', prefix: 'R$' },
  { key: 'cpm', label: 'CPM', prefix: 'R$' },
  { key: 'lpv', label: 'LPV' },
  { key: 'cost_per_result', label: 'Custo/Resultado', prefix: 'R$' },
  { key: 'cost_per_lpv', label: 'Custo/LPV', prefix: 'R$' },
  { key: 'roas', label: 'ROAS' },
];

export default function TargetsEditor() {
  const { state, dispatch } = useAppState();
  const month = state.selectedMonth;
  const existing = state.targets.find(t => t.month_key === month);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState<MonthlyTargets>({
    month_key: month || '',
    ...existing,
  });

  if (!month) return null;

  const save = () => {
    dispatch({ type: 'SET_TARGETS', targets: { ...form, month_key: month } });
    toast.success('Metas salvas');
  };

  const hasTargets = existing && Object.keys(existing).some(k => k !== 'month_key' && (existing as any)[k]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="glass-card">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-secondary/30 transition-colors rounded-lg">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Metas — {getMonthLabel(month)}
          {hasTargets && <span className="text-xs text-muted-foreground">(definidas)</span>}
        </h3>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {TARGET_FIELDS.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                type="number"
                step="any"
                value={(form as any)[f.key] || ''}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))}
                className="bg-secondary border-border text-sm"
                placeholder={f.prefix || '0'}
              />
            </div>
          ))}
        </div>
        <Button onClick={save} size="sm" className="mt-4">
          <Save className="h-4 w-4 mr-1" /> Salvar Metas
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}
