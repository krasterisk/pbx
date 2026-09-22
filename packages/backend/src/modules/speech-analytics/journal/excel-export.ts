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
  'id',
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
): Promise<Buffer> {
  const safeScales = sanitizeScaleKeys(scaleKeys);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Journal');
  const headers = [...JOURNAL_EXCEL_BASE_KEYS, ...safeScales];
  sheet.addRow(headers);

  for (const row of rows) {
    const values: Array<string | number | null> = [];
    for (const key of JOURNAL_EXCEL_BASE_KEYS) {
      if (key === 'transcript') {
        values.push(truncateCell(row.transcript));
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
