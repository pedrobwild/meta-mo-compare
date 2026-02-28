import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { MetaRecord, SourceType, ImportLog, HierarchyMaps } from './types';

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
  const month_key = extractMonthKey(report_start);

  const ad_key = normalize(ad_name);
  const campaign_key = campaign_name ? normalize(campaign_name) : null;
  const adset_key = adset_name ? normalize(adset_name) : null;

  const unique_key = [month_key, ad_key, campaign_key || '', adset_key || '', sourceType].join('|');

  return {
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

function checkCrossMonth(records: MetaRecord[]): string | null {
  for (const r of records) {
    if (r.report_start && r.report_end) {
      const startMonth = extractMonthKey(r.report_start);
      const endMonth = extractMonthKey(r.report_end);
      if (startMonth !== endMonth) {
        return `Período cruza meses (${r.report_start} a ${r.report_end}). Importe relatórios separados por mês.`;
      }
    }
  }
  return null;
}

export async function parseFile(file: File): Promise<{
  records: MetaRecord[];
  sourceType: SourceType;
  monthKey: string;
  log: ImportLog;
  crossMonthWarning: string | null;
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

  const crossMonthWarning = checkCrossMonth(records);
  const monthKeys = [...new Set(records.map(r => r.month_key))];
  const monthKey = monthKeys[0] || 'unknown';

  const log: ImportLog = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    filename: file.name,
    source_type: sourceType,
    month_key: monthKey,
    records_count: records.length,
    status: crossMonthWarning ? 'warning' : 'success',
    message: crossMonthWarning || `${records.length} registros importados (${sourceType})`,
  };

  return { records, sourceType, monthKey, log, crossMonthWarning };
}

export function upsertRecords(existing: MetaRecord[], incoming: MetaRecord[]): MetaRecord[] {
  const map = new Map<string, MetaRecord>();
  for (const r of existing) map.set(r.unique_key, r);
  for (const r of incoming) map.set(r.unique_key, r);
  return Array.from(map.values());
}

export function buildHierarchyMaps(records: MetaRecord[]): HierarchyMaps {
  const ad_to_adset: Record<string, string> = {};
  const ad_to_campaign: Record<string, string> = {};
  const adset_to_campaign: Record<string, string> = {};

  // Prefer type3 records
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
