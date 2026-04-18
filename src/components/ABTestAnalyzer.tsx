// ─── A/B Test Analyzer ───
// Lets the user pick two entities (campaign/adset/ad) from the current filter
// scope and runs proper two-proportion tests on CTR, LPV rate and Result/LPV.
// Output is designed for traffic managers who want to stop second-guessing
// whether a difference is signal or noise.

import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Trophy, AlertTriangle, ChevronsUpDown, Check, Calculator } from 'lucide-react';
import { useAppState, useFilteredRecords } from '@/lib/store';
import { groupByLevel, type GroupedRow } from '@/lib/calculations';
import { twoProportionTest, pBeatsA, sampleSizePerArm, wilsonInterval, type ProportionTestResult } from '@/lib/stats/proportions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type MetricKey = 'ctr_link' | 'lpv_rate' | 'result_per_lpv';

const METRIC_DEFS: Record<MetricKey, {
  label: string;
  numerator: (r: GroupedRow) => number;
  denominator: (r: GroupedRow) => number;
  hint: string;
  // Good direction — for CPA-like metrics we'd want 'down', but these are all rates where up = better.
  goodDirection: 'up';
}> = {
  ctr_link: {
    label: 'CTR Link',
    numerator: (r) => r.metrics.link_clicks,
    denominator: (r) => r.metrics.impressions,
    hint: 'link_clicks / impressões',
    goodDirection: 'up',
  },
  lpv_rate: {
    label: 'LPV Rate',
    numerator: (r) => r.metrics.landing_page_views,
    denominator: (r) => r.metrics.link_clicks,
    hint: 'landing_page_views / link_clicks',
    goodDirection: 'up',
  },
  result_per_lpv: {
    label: 'Result / LPV',
    numerator: (r) => r.metrics.results,
    denominator: (r) => r.metrics.landing_page_views,
    hint: 'results / landing_page_views',
    goodDirection: 'up',
  },
};

function fmtPct(x: number, digits = 2) {
  if (!Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}
function fmtSigned(x: number, digits = 2) {
  if (!Number.isFinite(x)) return '—';
  const sign = x > 0 ? '+' : '';
  return `${sign}${(x * 100).toFixed(digits)}%`;
}
function fmtPValue(p: number) {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.0001) return '<0.0001';
  return p.toFixed(4);
}

function EntityPicker({
  rows,
  value,
  onChange,
  label,
  excludeKey,
}: {
  rows: GroupedRow[];
  value: GroupedRow | null;
  onChange: (row: GroupedRow | null) => void;
  label: string;
  excludeKey?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-meta-caption text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-between w-full min-w-0">
            <span className="truncate text-left">
              {value ? value.name : <span className="text-muted-foreground">Selecionar…</span>}
            </span>
            <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <ScrollArea className="max-h-72">
            <div className="p-1">
              {rows
                .filter((r) => r.key !== excludeKey)
                .map((r) => {
                  const selected = r.key === value?.key;
                  return (
                    <button
                      key={r.key}
                      onClick={() => { onChange(r); setOpen(false); }}
                      className={`w-full text-left px-2 py-1.5 rounded-meta-btn hover:bg-secondary flex items-start gap-2 ${selected ? 'bg-secondary' : ''}`}
                    >
                      <Check className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${selected ? 'opacity-100 text-primary' : 'opacity-0'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-foreground truncate">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Spend R${r.metrics.spend_brl.toFixed(0)} · Impr {r.metrics.impressions.toLocaleString('pt-BR')} · CTR {r.metrics.ctr_link.toFixed(2)}%
                        </div>
                      </div>
                    </button>
                  );
                })}
              {rows.length === 0 && (
                <div className="px-2 py-3 text-sm text-muted-foreground">Sem entidades elegíveis no período.</div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MetricTestCard({
  metric,
  rowA,
  rowB,
}: {
  metric: MetricKey;
  rowA: GroupedRow;
  rowB: GroupedRow;
}) {
  const def = METRIC_DEFS[metric];
  const sA = def.numerator(rowA);
  const nA = def.denominator(rowA);
  const sB = def.numerator(rowB);
  const nB = def.denominator(rowB);

  // Guard: if either denominator is 0 we can't run the test.
  const runnable = nA > 0 && nB > 0;

  const test: ProportionTestResult | null = useMemo(() => {
    if (!runnable) return null;
    return twoProportionTest(sA, nA, sB, nB, 0.95);
  }, [sA, nA, sB, nB, runnable]);

  const pBetter = useMemo(() => {
    if (!runnable) return null;
    return pBeatsA(sA, nA, sB, nB, { samples: 10_000 });
  }, [sA, nA, sB, nB, runnable]);

  const wilsonA = useMemo(() => runnable ? wilsonInterval(sA, nA) : null, [sA, nA, runnable]);
  const wilsonB = useMemo(() => runnable ? wilsonInterval(sB, nB) : null, [sB, nB, runnable]);

  if (!runnable || !test) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-meta-body">{def.label}</CardTitle>
          <CardDescription className="text-[11px]">{def.hint}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Denominador zerado — não há dados suficientes para testar este metric.
        </CardContent>
      </Card>
    );
  }

  const winner: 'A' | 'B' | null = test.significant
    ? (test.absoluteLift > 0 ? 'B' : 'A')
    : null;

  const severity: 'high' | 'medium' | 'low' = test.significant ? 'high' : test.lowData ? 'low' : 'medium';
  const badgeClass =
    severity === 'high' ? 'bg-positive/20 text-positive border-positive/30' :
    severity === 'low' ? 'bg-muted text-muted-foreground border-border' :
    'bg-warning/20 text-warning border-warning/30';

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-meta-body">{def.label}</CardTitle>
          <CardDescription className="text-[11px]">{def.hint}</CardDescription>
        </div>
        <Badge variant="outline" className={badgeClass}>
          {test.significant ? 'Significativo' : test.lowData ? 'Dados insuficientes' : 'Sem diferença'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-meta-btn border border-border p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">A · {rowA.name}</div>
            <div className="text-meta-heading-sm text-foreground">{fmtPct(test.pA)}</div>
            <div className="text-[11px] text-muted-foreground">
              {sA.toLocaleString('pt-BR')} / {nA.toLocaleString('pt-BR')}
              {wilsonA && ` · IC95 [${fmtPct(wilsonA[0])}, ${fmtPct(wilsonA[1])}]`}
            </div>
          </div>
          <div className="rounded-meta-btn border border-border p-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">B · {rowB.name}</div>
            <div className="text-meta-heading-sm text-foreground">{fmtPct(test.pB)}</div>
            <div className="text-[11px] text-muted-foreground">
              {sB.toLocaleString('pt-BR')} / {nB.toLocaleString('pt-BR')}
              {wilsonB && ` · IC95 [${fmtPct(wilsonB[0])}, ${fmtPct(wilsonB[1])}]`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">Lift (B vs A)</div>
            <div className="text-foreground">
              {test.relativeLift !== null ? fmtSigned(test.relativeLift) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">IC 95% relativo</div>
            <div className="text-foreground">
              {test.ciRelative
                ? `[${fmtSigned(test.ciRelative[0])}, ${fmtSigned(test.ciRelative[1])}]`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase">p-value</div>
            <div className="text-foreground">{fmtPValue(test.pValue)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs bg-secondary/30 rounded-meta-btn px-2 py-1.5">
          <span className="text-muted-foreground">Prob. de B ser melhor (Bayesian)</span>
          <span className="text-foreground font-medium">{pBetter !== null ? `${(pBetter * 100).toFixed(1)}%` : '—'}</span>
        </div>

        {test.lowData && (
          <div className="flex items-start gap-2 text-[11px] text-warning bg-warning/10 rounded-meta-btn px-2 py-1.5 border border-warning/20">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>Amostra pequena (&lt;30 trials ou &lt;5 sucessos/falhas por variante). Resultados instáveis — aumentar coleta antes de decidir.</span>
          </div>
        )}

        {winner && (
          <div className="flex items-center gap-2 text-sm bg-positive/10 border border-positive/20 rounded-meta-btn px-2 py-1.5 text-positive">
            <Trophy className="h-4 w-4 flex-shrink-0" />
            <span>
              Vencedor: <strong>{winner === 'A' ? rowA.name : rowB.name}</strong>.
              {' '}Diferença estatisticamente significativa (p={fmtPValue(test.pValue)}).
            </span>
          </div>
        )}
        {!winner && !test.lowData && (
          <div className="text-[11px] text-muted-foreground">
            Sem diferença significativa. Coletar mais dados ou aumentar spend pode mudar o quadro — o tamanho de efeito mínimo detectável no volume atual é maior que a diferença observada.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SampleSizePanel() {
  const [baseline, setBaseline] = useState(2.0); // 2% CTR por default
  const [mde, setMde] = useState(20); // 20% relative
  const [power, setPower] = useState(0.8);
  const [alpha, setAlpha] = useState(0.05);

  const result = useMemo(() => {
    const p = baseline / 100;
    const rel = mde / 100;
    if (p <= 0 || p >= 1) return null;
    const n = sampleSizePerArm(p, rel, { alpha, power, relative: true });
    return n;
  }, [baseline, mde, alpha, power]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-meta-body flex items-center gap-2">
          <Calculator className="h-4 w-4" strokeWidth={1.5} /> Calculadora de amostra
        </CardTitle>
        <CardDescription className="text-[11px]">
          Quantas impressões (ou cliques) por variante para detectar o MDE com a potência configurada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Taxa base (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0.01"
              max="99"
              value={baseline}
              onChange={(e) => setBaseline(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">MDE relativo (%)</Label>
            <Input
              type="number"
              step="1"
              min="1"
              max="500"
              value={mde}
              onChange={(e) => setMde(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Potência</Label>
            <Select value={String(power)} onValueChange={(v) => setPower(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.7">70%</SelectItem>
                <SelectItem value="0.8">80%</SelectItem>
                <SelectItem value="0.9">90%</SelectItem>
                <SelectItem value="0.95">95%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Alpha (falso positivo)</Label>
            <Select value={String(alpha)} onValueChange={(v) => setAlpha(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.1">10%</SelectItem>
                <SelectItem value="0.05">5% (padrão)</SelectItem>
                <SelectItem value="0.01">1%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="bg-secondary/40 rounded-meta-btn p-3">
          <div className="text-[11px] text-muted-foreground">Amostra requerida por variante</div>
          <div className="text-meta-heading text-foreground">
            {result === null
              ? '—'
              : !Number.isFinite(result)
                ? '∞ (lift inválido)'
                : result.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Total do teste: {result && Number.isFinite(result) ? (result * 2).toLocaleString('pt-BR') : '—'} (soma das duas variantes)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ABTestAnalyzer() {
  const { state } = useAppState();
  const { current, previous } = useFilteredRecords();
  const [aKey, setAKey] = useState<string | null>(null);
  const [bKey, setBKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (current.length === 0) return [];
    return groupByLevel(current, previous, state.analysisLevel, '', false)
      .filter((r) => r.metrics.impressions >= 100 && r.metrics.spend_brl > 0);
  }, [current, previous, state.analysisLevel]);

  const rowA = rows.find((r) => r.key === aKey) || null;
  const rowB = rows.find((r) => r.key === bKey) || null;

  // Best-effort default selection: top spender vs #2 spender.
  useEffect(() => {
    if (rows.length >= 2 && !aKey && !bKey) {
      setAKey(rows[0].key);
      setBKey(rows[1].key);
    }
  }, [rows, aKey, bKey]);

  if (current.length === 0) {
    return (
      <div className="text-center py-16 space-y-3 bg-card border border-border rounded-meta-card">
        <FlaskConical className="h-12 w-12 text-muted-foreground/30 mx-auto" strokeWidth={1.5} />
        <p className="text-meta-body text-muted-foreground">Selecione um período com dados para rodar um teste A/B.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-meta-heading-sm">
                <FlaskConical className="h-4 w-4 text-primary" strokeWidth={1.5} />
                A/B Test Analyzer
              </CardTitle>
              <CardDescription>
                Compare duas {state.analysisLevel === 'ad' ? 'criativos' : state.analysisLevel === 'adset' ? 'conjuntos' : 'campanhas'} com significância estatística real. Testes de duas proporções bilaterais, IC 95%, lift relativo com delta-method.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Nível: {state.analysisLevel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <EntityPicker rows={rows} value={rowA} onChange={(r) => setAKey(r?.key ?? null)} label="Variante A (controle)" excludeKey={bKey} />
          <EntityPicker rows={rows} value={rowB} onChange={(r) => setBKey(r?.key ?? null)} label="Variante B (desafiante)" excludeKey={aKey} />
        </CardContent>
      </Card>

      {rowA && rowB && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricTestCard metric="ctr_link" rowA={rowA} rowB={rowB} />
          <MetricTestCard metric="lpv_rate" rowA={rowA} rowB={rowB} />
          <MetricTestCard metric="result_per_lpv" rowA={rowA} rowB={rowB} />
        </div>
      )}

      <SampleSizePanel />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-meta-body">Como ler este painel</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong className="text-foreground">Significativo</strong>: p &lt; 5%. A diferença observada tem &lt;5% de chance de ser ruído — decida pelo resultado observado.
          </p>
          <p>
            <strong className="text-foreground">Dados insuficientes</strong>: alguma variante tem menos de 30 trials ou menos de 5 sucessos/falhas. Continue coletando antes de ler o p-value.
          </p>
          <p>
            <strong className="text-foreground">Probabilidade bayesiana</strong>: sob prior uniforme, estimativa via Monte Carlo (10k amostras) de P(B &gt; A). Leitura mais natural do que p-value, útil para comunicar a stakeholders.
          </p>
          <p>
            <strong className="text-foreground">IC 95% relativo</strong>: se o intervalo inclui 0%, evite decisões. Use-o para calibrar expectativa de lift real, não só o ponto central.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
