import ExcelJS from 'exceljs';
import type { ReportColumn } from '../callcenter-reports.types';

/**
 * XLSX export via exceljs writeBuffer (D-34).
 * Operates only on already tenant-scoped rows — no DB access.
 */
export async function buildReportXlsx(
  sheetName: string,
  columns: ReportColumn[],
  rows: Array<Record<string, unknown>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || 'Report');
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: Math.max(12, c.header.length + 2),
  }));
  for (const row of rows) {
    const flat: Record<string, unknown> = {};
    for (const c of columns) {
      const val = row[c.key];
      flat[c.key] =
        val != null && typeof val === 'object' ? JSON.stringify(val) : val;
    }
    sheet.addRow(flat);
  }
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
