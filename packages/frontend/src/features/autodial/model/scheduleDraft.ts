import type { AutodialScheduleDraft } from './campaignDraft';
export function scheduleDraftError(row: AutodialScheduleDraft): 'time' | 'weekday' | 'timezone' | 'dates' | null {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(row.time_from) || !time.test(row.time_to) || row.time_from === row.time_to) return 'time';
  if (row.kind === 'weekly' && (!Number.isInteger(row.weekday) || row.weekday! < 0 || row.weekday! > 6)) return 'weekday';
  try { if (!row.timezone?.trim()) return 'timezone'; new Intl.DateTimeFormat('en', { timeZone: row.timezone }).format(); } catch { return 'timezone'; }
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!['weekly', 'date_range', 'one_off'].includes(row.kind) || row.date_from && !date(row.date_from) || row.date_to && !date(row.date_to)
    || row.kind === 'one_off' && !row.date_from
    || row.kind !== 'one_off' && row.date_from && row.date_to && row.date_from > row.date_to) return 'dates';
  return null;
}
