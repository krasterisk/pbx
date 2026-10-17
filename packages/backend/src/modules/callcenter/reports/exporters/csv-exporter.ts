import type { ReportColumn } from '../callcenter-reports.types';
import { exportHeader, exportValue } from './export-value';

/**
 * Hand-rolled CSV builder (same convention as cdr.controller export):
 * delimiter `;`, double-quote escape, UTF-8 BOM.
 */
export function buildReportCsv(
  columns: ReportColumn[],
  rows: Array<Record<string, unknown>>,
  timezone?: string,
): string {
  const delimiter = ';';
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = columns.map((c) => esc(exportHeader(c, timezone))).join(delimiter);
  const lines = rows.map((row) =>
    columns.map((c) => {
      const val = exportValue(c, row[c.key], timezone);
      if (val != null && typeof val === 'object') {
        return esc(JSON.stringify(val));
      }
      return esc(val);
    }).join(delimiter),
  );
  return '\uFEFF' + [header, ...lines].join('\n');
}
