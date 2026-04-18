import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { MetaRecord, SourceType, ImportLog, HierarchyMaps, PeriodGranularity } from './types';

// ─── Column aliasing ────────────────────────────────────────────────────
// Many users export data in Portuguese (Meta Ads Manager pt-BR), English (en-US)
// or via third-party tools (Supermetrics, Rollworks). We map aliases to our
// canonical MetaRecord field names. Matching is case-insensitive and accent-
// insensitive (see `normalize`).

type Field = keyof MetaRecord;

const COLUMN_ALIASES: Record<Field, string[]> = {
  ad_name: ['nome do anuncio', 'ad name', 'anuncio', 'ad', 'creative name'],
  campaign_name: ['nome da campanha', 'campaign name', 'campanha', 'campaign'],
  adset_name: [
    'nome do conjunto de anuncios',
    'nome do conjunto',
    'adset name',
    'ad set name',
    'conjunto',
    'adset',
  ],
  delivery_status: ['status de veiculacao', 'delivery status', 'status', 'ad delivery status'],
  delivery_level: ['nivel de veiculacao', 'delivery level', 'level', 'nivel'],
  result_type: ['tipo de resultado', 'result type', 'optimization goal', 'objetivo'],
  results: ['resultados', 'results', 'conversoes', 'conversions'],
  reach: ['alcance', 'reach'],
  frequency: ['frequencia', 'frequency'],
  cost_per_result: ['custo por resultado', 'cost per result', 'cost per conversion', 'cpa', 'custo por conversao'],
  spend_brl: [
    'valor usado (brl)',
    'valor usado',
    'valor gasto',
    'amount spent (brl)',
    'amount spent',
    'spend',
    'gasto',
    'investimento',
  ],
  impressions: ['impressoes', 'impressions'],
  cpm: ['cpm (custo por 1.000 impressoes)', 'cpm', 'custo por mil impressoes'],
  link_clicks: ['cliques no link', 'link clicks', 'cliques_link'],
  cpc_link: ['cpc (custo por clique no link)', 'cpc link', 'custo por clique no link', 'link cpc'],
  ctr_link: ['ctr (taxa de cliques no link)', 'ctr link', 'link ctr', 'taxa de cliques no link'],
  clicks_all: ['cliques (todos)', 'clicks (all)', 'clicks all', 'total clicks', 'cliques totais'],
  ctr_all: ['ctr (todos)', 'ctr all', 'ctr'],
  cpc_all: ['cpc (todos)', 'cpc all', 'cpc'],
  landing_page_views: ['visualizacoes da pagina de destino', 'landing page views', 'lpv'],
  cost_per_lpv: ['custo por visualizacao da pagina de destino', 'cost per landing page view', 'custo por lpv'],
  report_start: ['inicio dos relatorios', 'reporting starts', 'date start', 'data inicio'],
  report_end: ['termino dos relatorios', 'reporting ends', 'date stop', 'data fim'],
  // Canonical-only fields (not mapped from input)
  period_start: [],
  period_end: [],
  period_key: [],
  granularity: [],
  month_key: [],
  ad_key: [],
  campaign_key: [],
  adset_key: [],
  source_type: [],
  unique_key: [],
};

/**
 * Slug used internally for column matching: lowercase, no accents, collapsed
 * whitespace, no zero-width characters.
 */
export function normalize(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Build a lookup from normalized header → field. Pre-computed once so row
 * mapping is a single O(headers) scan per row.
 */
function buildHeaderIndex(headers: string[]): Map<string, Field> {
  const index = new Map<string, Field>();
  const normalizedHeaders = headers.map((h) => normalize(h));
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [Field, string[]][]) {
    for (const alias of aliases) {
      const n = normalize(alias);
      const matchIdx = normalizedHeaders.indexOf(n);
      if (matchIdx >= 0) {
        index.set(headers[matchIdx], field);
        break;
      }
    }
  }
  return index;
}

function detectSourceType(headerIndex: Map<string, Field>): SourceType {
  const fields = new Set(headerIndex.values());
  const hasAd = fields.has('ad_name');
  const hasCampaign = fields.has('campaign_name');
  const hasAdset = fields.has('adset_name');
  if (hasAd && hasCampaign && hasAdset) return 'type3_full';
  if (hasAd && hasCampaign) return 'type2_ad_campaign';
  return 'type1_ad_only';
}

/**
 * Robust number parser: handles BR ("1.234,56"), US ("1,234.56"), plain
 * numeric values, and already-numeric inputs. Strips currency symbols and
 * percentage signs.
 */
function parseNumber(val: unknown): number {
  if (val == null || val === '' || val === '-') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const raw = String(val).trim();
  if (!raw) return 0;

  // Detect format: if there are both comma and dot, treat the last one as decimal
  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  let cleaned = raw.replace(/[^\d.,\-]/g, '');
  if (hasComma && hasDot) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      // BR: "1.234,56" → "1234.56"
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US: "1,234.56" → "1234.56"
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // "1,234" could be BR decimal or US thousands. Heuristic: 3-digit group after comma => thousands.
    const after = cleaned.slice(cleaned.lastIndexOf(',') + 1);
    if (after.length === 3 && !cleaned.slice(0, cleaned.lastIndexOf(',')).includes(',')) {
      cleaned = cleaned.replace(',', '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  }
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (!str) return null;
  // DD/MM/YYYY or DD-MM-YYYY
  const ptMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ptMatch) {
    return `${ptMatch[3]}-${ptMatch[2].padStart(2, '0')}-${ptMatch[1].padStart(2, '0')}`;
  }
  // MM/DD/YYYY (US): we can't tell without locale info. Prefer DD/MM since most
  // Meta Ads exports in Brazil use that. Still keep an ISO fallback below.
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // Try Date.parse as last resort
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

function extractMonthKey(dateStr: string | null): string {
  if (!dateStr) return 'unknown';
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  return 'unknown';
}

function detectGranularity(start: string, end: string): PeriodGranularity {
  return start === end ? 'day' : 'week';
}

function generatePeriodKey(start: string, end: string, granularity: PeriodGranularity): string {
  if (granularity === 'day') return start;
  return `${start}_${end}`;
}

function mapRow(
  row: Record<string, unknown>,
  headerIndex: Map<string, Field>,
  sourceType: SourceType,
): MetaRecord | null {
  const mapped: Partial<Record<Field, unknown>> = {};
  for (const [originalHeader, field] of headerIndex.entries()) {
    if (row[originalHeader] !== undefined) {
      mapped[field] = row[originalHeader];
    }
  }

  if (!mapped.ad_name) return null;

  const ad_name = String(mapped.ad_name || '').trim();
  const campaign_name = mapped.campaign_name ? String(mapped.campaign_name).trim() : null;
  const adset_name = mapped.adset_name ? String(mapped.adset_name).trim() : null;

  const report_start = parseDate(mapped.report_start);
  const report_end = parseDate(mapped.report_end);

  const period_start = report_start || 'unknown';
  const period_end = report_end || period_start;
  const granularity = period_start !== 'unknown' && period_end !== 'unknown' ? detectGranularity(period_start, period_end) : 'week';
  const period_key = period_start !== 'unknown' ? generatePeriodKey(period_start, period_end, granularity) : 'unknown';
  const month_key = extractMonthKey(period_start);

  const ad_key = normalize(ad_name);
  const campaign_key = campaign_name ? normalize(campaign_name) : null;
  const adset_key = adset_name ? normalize(adset_name) : null;

  const unique_key = [ad_key, campaign_key || '', adset_key || '', sourceType, mapped.delivery_level || ''].join('|');

  return {
    period_start,
    period_end,
    period_key,
    granularity,
    month_key,
    ad_key,
    campaign_key,
    adset_key,
    source_type: sourceType,
    unique_key,
    ad_name,
    campaign_name,
    adset_name,
    delivery_status: (mapped.delivery_status as string) || null,
    delivery_level: (mapped.delivery_level as string) || null,
    result_type: (mapped.result_type as string) || null,
    results: parseNumber(mapped.results),
    reach: parseNumber(mapped.reach),
    frequency: parseNumber(mapped.frequency),
    cost_per_result: parseNumber(mapped.cost_per_result),
    spend_brl: parseNumber(mapped.spend_brl),
    impressions: parseNumber(mapped.impressions),
    cpm: parseNumber(mapped.cpm),
    link_clicks: parseNumber(mapped.link_clicks),
    cpc_link: parseNumber(mapped.cpc_link),
    ctr_link: parseNumber(mapped.ctr_link),
    clicks_all: parseNumber(mapped.clicks_all),
    ctr_all: parseNumber(mapped.ctr_all),
    cpc_all: parseNumber(mapped.cpc_all),
    landing_page_views: parseNumber(mapped.landing_page_views),
    cost_per_lpv: parseNumber(mapped.cost_per_lpv),
    report_start,
    report_end,
  };
}

export interface ParseWarning {
  row: number;
  reason: string;
}

export interface ParseResult {
  records: MetaRecord[];
  sourceType: SourceType;
  periodKey: string;
  granularity: PeriodGranularity;
  warnings: ParseWarning[];
  unmatchedHeaders: string[];
  log: ImportLog;
}

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  let rows: Record<string, unknown>[];

  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    rows = await new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        // papaparse delimiter auto-detect handles comma/semicolon/tab fine
        complete: (result) => resolve(result.data),
        error: reject,
      });
    });
  } else if (ext === 'xlsx' || ext === 'xls' || ext === 'ods') {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  } else {
    throw new Error(`Formato não suportado: ${ext}. Envie CSV, TSV ou XLSX.`);
  }

  if (!rows.length) throw new Error('Arquivo vazio — nenhuma linha encontrada.');

  const headers = Object.keys(rows[0]);
  const headerIndex = buildHeaderIndex(headers);
  const unmatchedHeaders = headers.filter((h) => !headerIndex.has(h));

  if (!headerIndex.size) {
    throw new Error(
      'Nenhuma coluna reconhecida. Verifique se você está exportando do Gerenciador de Anúncios do Meta (PT ou EN).',
    );
  }

  const sourceType = detectSourceType(headerIndex);

  const records: MetaRecord[] = [];
  const warnings: ParseWarning[] = [];
  rows.forEach((row, i) => {
    const record = mapRow(row, headerIndex, sourceType);
    if (!record) {
      warnings.push({ row: i + 2, reason: 'linha sem nome de anúncio' });
      return;
    }
    records.push(record);
  });

  if (records.length === 0) {
    throw new Error('Nenhum registro válido encontrado. Verifique o arquivo.');
  }

  const periodKeys = [...new Set(records.map((r) => r.period_key))];
  const periodKey = periodKeys[0] || 'unknown';
  const granularity = records[0]?.granularity || 'week';

  const status: ImportLog['status'] = warnings.length > 0 ? 'warning' : 'success';
  const message =
    warnings.length > 0
      ? `${records.length} registros importados, ${warnings.length} linhas ignoradas (${sourceType})`
      : `${records.length} registros importados (${sourceType}, ${periodKey})`;

  const log: ImportLog = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    filename: file.name,
    source_type: sourceType,
    period_key: periodKey,
    granularity,
    records_count: records.length,
    status,
    message,
  };

  return { records, sourceType, periodKey, granularity, warnings, unmatchedHeaders, log };
}

export function upsertRecords(existing: MetaRecord[], incoming: MetaRecord[]): MetaRecord[] {
  const map = new Map<string, MetaRecord>();
  const makeKey = (r: MetaRecord) => `${r.unique_key}|${r.period_key}|${r.granularity}`;
  for (const r of existing) map.set(makeKey(r), r);
  for (const r of incoming) map.set(makeKey(r), r);
  return Array.from(map.values());
}

export function buildHierarchyMaps(records: MetaRecord[]): HierarchyMaps {
  const ad_to_adset: Record<string, string> = {};
  const ad_to_campaign: Record<string, string> = {};
  const adset_to_campaign: Record<string, string> = {};

  const sorted = [...records].sort((a, b) => {
    const order: Record<string, number> = { type3_full: 0, type2_ad_campaign: 1, type1_ad_only: 2 };
    return (order[a.source_type] || 2) - (order[b.source_type] || 2);
  });

  for (const r of sorted) {
    if (r.adset_key && !ad_to_adset[r.ad_key]) ad_to_adset[r.ad_key] = r.adset_key;
    if (r.campaign_key && !ad_to_campaign[r.ad_key]) ad_to_campaign[r.ad_key] = r.campaign_key;
    if (r.adset_key && r.campaign_key && !adset_to_campaign[r.adset_key]) {
      adset_to_campaign[r.adset_key] = r.campaign_key;
    }
  }
  return { ad_to_adset, ad_to_campaign, adset_to_campaign };
}

export function enrichRecords(records: MetaRecord[], maps: HierarchyMaps): MetaRecord[] {
  return records.map((r) => ({
    ...r,
    campaign_key: r.campaign_key || maps.ad_to_campaign[r.ad_key] || null,
    campaign_name: r.campaign_name || (maps.ad_to_campaign[r.ad_key] ? maps.ad_to_campaign[r.ad_key] : null),
    adset_key: r.adset_key || maps.ad_to_adset[r.ad_key] || null,
    adset_name: r.adset_name || (maps.ad_to_adset[r.ad_key] ? maps.ad_to_adset[r.ad_key] : null),
  }));
}
