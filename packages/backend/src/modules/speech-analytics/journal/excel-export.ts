import type { CdrAccessScope } from '../../reports/cdr/cdr-access-scope';
import type { JournalRowAccessFields, JournalViewer } from './journal.service';

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

/** Stub — RED phase; GREEN implements truncate + workbook. */
export function truncateCell(value: unknown, _limit = EXCEL_CELL_CHAR_LIMIT): string {
  return value == null ? '' : String(value);
}

export function filterExportRowsByAccess<T extends JournalExcelRow & JournalRowAccessFields>(
  rows: T[],
  _scope: CdrAccessScope | null,
  _viewer: JournalViewer,
): T[] {
  return rows;
}

export async function buildJournalExcel(
  rows: JournalExcelRow[],
  _scaleKeys: string[],
): Promise<Buffer> {
  // Stub workbook — wrong headers (includes a robot column) and untruncated transcript.
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Journal');
  sheet.addRow(['id', 'automationRate', 'transcript']);
  for (const row of rows) {
    sheet.addRow([row.id, '0', row.transcript ?? '']);
  }
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
