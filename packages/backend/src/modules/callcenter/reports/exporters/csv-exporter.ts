import type { ReportColumn } from '../callcenter-reports.types';

/**
 * Hand-rolled CSV builder (same convention as cdr.controller export):
 * delimiter `;`, double-quote escape, UTF-8 BOM.
 */
export function buildReportCsv(
  columns: ReportColumn[],
  rows: Array<Record<string, unknown>>,
): string {
  const delimiter = ';';
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = columns.map((c) => esc(c.header)).join(delimiter);
  const lines = rows.map((row) =>
    columns.map((c) => {
      const val = row[c.key];
      if (val != null && typeof val === 'object') {
        return esc(JSON.stringify(val));
      }
      return esc(val);
    }).join(delimiter),
  );
  return '\uFEFF' + [header, ...lines].join('\n');
}
