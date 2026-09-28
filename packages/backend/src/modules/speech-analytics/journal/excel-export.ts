import ExcelJS from 'exceljs';
import type { CdrAccessScope } from '../../reports/cdr/cdr-access-scope';
import {
  isJournalRowVisible,
  type JournalRowAccessFields,
  type JournalViewer,
} from './journal.service';

/** Excel worksheet cell character limit (aiPBX truncateCell parity). */
export const EXCEL_CELL_CHAR_LIMIT = 32767;

export const JOURNAL_EXCEL_BASE_KEYS = [
  'occurredAt',
  'sourceKind',
  'latestAmount',
  'currency',
  'summary',
  'transcript',
  'sttQuality',
  'topics',
  'rationales',
] as const;

export type JournalExcelBaseKey = typeof JOURNAL_EXCEL_BASE_KEYS[number];
export type JournalExcelHeaderLabels = Partial<Record<JournalExcelBaseKey, string>>;

const HEADER_LABELS: Record<'ru' | 'en', Record<JournalExcelBaseKey, string>> = {
  ru: {
    occurredAt: 'Дата',
    sourceKind: 'Источник',
    latestAmount: 'Стоимость',
    currency: 'Валюта',
    summary: 'Саммари',
    transcript: 'Расшифровка',
    sttQuality: 'Качество распознавания',
    topics: 'Темы',
    rationales: 'Обоснования',
  },
  en: {
    occurredAt: 'Date',
    sourceKind: 'Source',
    latestAmount: 'Cost',
    currency: 'Currency',
    summary: 'Summary',
    transcript: 'Transcript',
    sttQuality: 'Recognition quality',
    topics: 'Topics',
    rationales: 'Rationales',
  },
};

function excelLocale(locale?: string): 'ru' | 'en' {
  return (locale ?? '').toLowerCase().startsWith('en') ? 'en' : 'ru';
}

/** Same fields as the journal table: calendar date and hours:minutes, 24-hour clock. */
export function formatJournalExcelDate(value: string, locale?: string, timeZone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '';
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  if (timeZone) options.timeZone = timeZone;
  try {
    return new Intl.DateTimeFormat(excelLocale(locale), options).format(date);
  } catch {
    return new Intl.DateTimeFormat(excelLocale(locale), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
}

export function journalExcelHeader(
  key: JournalExcelBaseKey,
  locale?: string,
  labels?: JournalExcelHeaderLabels,
): string {
  const custom = labels?.[key]?.trim();
  if (custom) return custom;
  return HEADER_LABELS[excelLocale(locale)][key];
}

/** Robot KPI columns intentionally excluded from SA journal Excel (D-37). */
export const ROBOT_COLUMN_KEYS = [
  'automationRate',
  'escalationRate',
  'costSavings',
  'escalationReason',
  'bailOut',
  'frustration',
  'averageTurns',
  'dialogCompletion',
  'entityExtraction',
  'contextRetention',
  'intentRecognition',
] as const;

const ROBOT_KEY_SET = new Set<string>(ROBOT_COLUMN_KEYS);

export type JournalExcelRow = {
  id: string;
  occurredAt: string;
  sourceKind: string;
  latestAmount: string | number | null;
  currency: string | null;
  summary: string | null;
  transcript: string | null;
  sttQuality: string | null;
  topics: string | null;
  rationales: string | null;
  scales: Record<string, string | number | null>;
};

export function truncateCell(value: unknown, limit = EXCEL_CELL_CHAR_LIMIT): string {
  const text = value == null ? '' : String(value);
  return text.length > limit ? text.slice(0, limit) : text;
}

export function filterExportRowsByAccess<T extends JournalExcelRow & JournalRowAccessFields>(
  rows: T[],
  scope: CdrAccessScope | null,
  viewer: JournalViewer,
): T[] {
  return rows.filter((row) => isJournalRowVisible(row, scope, viewer));
}

export function sanitizeScaleKeys(scaleKeys: string[]): string[] {
  return scaleKeys.filter((key) => !ROBOT_KEY_SET.has(key));
}

/**
 * Build a journal Excel workbook for the full access-scoped selection (D-37).
 * Long transcripts are truncated with the same limit as aiPBX truncateCell.
 */
export async function buildJournalExcel(
  rows: JournalExcelRow[],
  scaleKeys: string[],
  presentation?: { locale?: string; timeZone?: string; headers?: JournalExcelHeaderLabels },
): Promise<Buffer> {
  const safeScales = sanitizeScaleKeys(scaleKeys);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Journal');
  const headers = [
    ...JOURNAL_EXCEL_BASE_KEYS.map((key) => journalExcelHeader(key, presentation?.locale, presentation?.headers)),
    ...safeScales,
  ];
  sheet.addRow(headers);

  for (const row of rows) {
    const values: Array<string | number | null> = [];
    for (const key of JOURNAL_EXCEL_BASE_KEYS) {
      if (key === 'transcript') {
        values.push(truncateCell(row.transcript));
        continue;
      }
      if (key === 'occurredAt') {
        values.push(formatJournalExcelDate(row.occurredAt, presentation?.locale, presentation?.timeZone));
        continue;
      }
      const raw = row[key];
      values.push(raw == null ? '' : (raw as string | number));
    }
    for (const scaleKey of safeScales) {
      const scaleVal = row.scales[scaleKey];
      values.push(scaleVal == null ? '' : scaleVal);
    }
    sheet.addRow(values);
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
