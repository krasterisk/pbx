import type { ReportColumn } from '../callcenter-reports.types';

/** Export wall times use the same tenant zone as report rows and heatmaps. */
export function exportValue(column: ReportColumn, value: unknown, timezone?: string): unknown {
  if (!timezone || column.type !== 'datetime' || value == null || value === '') return value;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(date);
}

export function exportHeader(column: ReportColumn, timezone?: string): string {
  return timezone && column.type === 'datetime' ? `${column.header} (${timezone})` : column.header;
}
