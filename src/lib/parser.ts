import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { MetaRecord, SourceType, ImportLog, HierarchyMaps, PeriodGranularity } from './types';

const COLUMN_MAP: Record<string, keyof MetaRecord> = {
  'Nome do anúncio': 'ad_name',
  'Nome da campanha': 'campaign_name',
  'Nome do conjunto de anúncios': 'adset_name',
  'Status de veiculação': 'delivery_status',
  'Nível de veiculação': 'delivery_level',
  'Tipo de resultado': 'result_type',
  'Resultados': 'results',
  'Alcance': 'reach',
  'Frequência': 'frequency',
  'Custo por resultado': 'cost_per_result',
  'Valor usado (BRL)': 'spend_brl',
  'Impressões': 'impressions',
  'CPM (custo por 1.000 impressões)': 'cpm',
  'Cliques no link': 'link_clicks',
  'CPC (custo por clique no link)': 'cpc_link',
  'CTR (taxa de cliques no link)': 'ctr_link',
  'Cliques (todos)': 'clicks_all',
  'CTR (todos)': 'ctr_all',
  'CPC (todos)': 'cpc_all',
  'Visualizações da página de destino': 'landing_page_views',
  'Custo por visualização da página de destino': 'cost_per_lpv',
  'Início dos relatórios': 'report_start',
  'Término dos relatórios': 'report_end',
};

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

function detectSourceType(headers: string[]): SourceType {
  const hasAd = headers.includes('Nome do anúncio');
  const hasCampaign = headers.includes('Nome da campanha');
  const hasAdset = headers.includes('Nome do conjunto de anúncios');

  if (hasAd && hasCampaign && hasAdset) return 'type3_full';
  if (hasAd && hasCampaign) return 'type2_ad_campaign';
  return 'type1_ad_only';
}

function parseNumber(val: any): number {
  if (val == null || val === '' || val === '-') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function parseDate(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  // Try DD/MM/YYYY
  const parts = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (parts) {
    return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  // Try YYYY-MM-DD
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return str;
}

function extractMonthKey(dateStr: string | null): string {
  if (!dateStr) return 'unknown';
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  return 'unknown';
}

// Detect granularity from period_start and period_end
function detectGranularity(start: string, end: string): PeriodGranularity {
  return start === end ? 'day' : 'week';
}

// Generate ISO week key from a date string
function getISOWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  // ISO week: Monday is first day
  const dayOfWeek = d.getDay() || 7; // Sunday=7
  d.setDate(d.getDate() + 4 - dayOfWeek); // Thursday of this week
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Generate period_key based on granularity
function generatePeriodKey(start: string, granularity: PeriodGranularity): string {
  if (granularity === 'day') return start; // "YYYY-MM-DD"
  return getISOWeekKey(start); // "YYYY-Www"
}

function mapRow(row: Record<string, any>, sourceType: SourceType): MetaRecord | null {
  const mapped: any = {};
  for (const [ptCol, field] of Object.entries(COLUMN_MAP)) {
    if (row[ptCol] !== undefined) {
      mapped[field] = row[ptCol];
    }
  }

  if (!mapped.ad_name) return null;

  const ad_name = String(mapped.ad_name || '');
  const campaign_name = mapped.campaign_name ? String(mapped.campaign_name) : null;
  const adset_name = mapped.adset_name ? String(mapped.adset_name) : null;

  const report_start = parseDate(mapped.report_start);
  const report_end = parseDate(mapped.report_end);

  // Period fields
  const period_start = report_start || 'unknown';
  const period_end = report_end || period_start;
  const granularity = period_start !== 'unknown' && period_end !== 'unknown'
    ? detectGranularity(period_start, period_end)
    : 'week';
  const period_key = period_start !== 'unknown'
    ? generatePeriodKey(period_start, granularity)
    : 'unknown';

  // Legacy month_key derived from period_start
  const month_key = extractMonthKey(period_start);

  const ad_key = normalize(ad_name);
  const campaign_key = campaign_name ? normalize(campaign_name) : null;
  const adset_key = adset_name ? normalize(adset_name) : null;

  // Robust unique_key: normalized identity + level
  const unique_key = [
    ad_key,
    campaign_key || '',
    adset_key || '',
    sourceType,
    mapped.delivery_level || '',
  ].join('|');

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
    delivery_status: mapped.delivery_status || null,
    delivery_level: mapped.delivery_level || null,
    result_type: mapped.result_type || null,
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

export async function parseFile(file: File): Promise<{
  records: MetaRecord[];
  sourceType: SourceType;
  periodKey: string;
  granularity: PeriodGranularity;
  log: ImportLog;
}> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  let rows: Record<string, any>[];

  if (ext === 'csv') {
    rows = await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (result) => resolve(result.data as Record<string, any>[]),
        error: reject,
      });
    });
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  } else {
    throw new Error(`Formato não suportado: ${ext}`);
  }

  if (!rows.length) throw new Error('Arquivo vazio');

  const headers = Object.keys(rows[0]);
  const sourceType = detectSourceType(headers);

  const records: MetaRecord[] = [];
  for (const row of rows) {
    const record = mapRow(row, sourceType);
    if (record) records.push(record);
  }

  const periodKeys = [...new Set(records.map(r => r.period_key))];
  const periodKey = periodKeys[0] || 'unknown';
  const granularity = records[0]?.granularity || 'week';

  const log: ImportLog = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    filename: file.name,
    source_type: sourceType,
    period_key: periodKey,
    granularity,
    records_count: records.length,
    status: 'success',
    message: `${records.length} registros importados (${sourceType}, ${periodKey})`,
  };

  return { records, sourceType, periodKey, granularity, log };
}

export function upsertRecords(existing: MetaRecord[], incoming: MetaRecord[]): MetaRecord[] {
  const map = new Map<string, MetaRecord>();
  // Key by unique_key + period_key + granularity for proper dedup
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
    if (r.adset_key && !ad_to_adset[r.ad_key]) {
      ad_to_adset[r.ad_key] = r.adset_key;
    }
    if (r.campaign_key && !ad_to_campaign[r.ad_key]) {
      ad_to_campaign[r.ad_key] = r.campaign_key;
    }
    if (r.adset_key && r.campaign_key && !adset_to_campaign[r.adset_key]) {
      adset_to_campaign[r.adset_key] = r.campaign_key;
    }
  }

  return { ad_to_adset, ad_to_campaign, adset_to_campaign };
}

export function enrichRecords(records: MetaRecord[], maps: HierarchyMaps): MetaRecord[] {
  return records.map(r => ({
    ...r,
    campaign_key: r.campaign_key || maps.ad_to_campaign[r.ad_key] || null,
    campaign_name: r.campaign_name || (maps.ad_to_campaign[r.ad_key] ? maps.ad_to_campaign[r.ad_key] : null),
    adset_key: r.adset_key || maps.ad_to_adset[r.ad_key] || null,
    adset_name: r.adset_name || (maps.ad_to_adset[r.ad_key] ? maps.ad_to_adset[r.ad_key] : null),
  }));
}
