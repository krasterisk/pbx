import type { IAutodialBaseField } from '@krasterisk/shared';

export function formatContactValue(
  field: Pick<IAutodialBaseField, 'type' | 'format'>,
  raw: unknown,
  options: { locale?: string; yes: string; no: string; empty: string },
): string {
  if (raw === undefined || raw === null || raw === '') return options.empty;
  if (field.type === 'boolean' && typeof raw === 'boolean') return raw ? options.yes : options.no;
  if (field.type === 'money' && typeof raw === 'number' && Number.isFinite(raw)) {
    return raw.toLocaleString(options.locale, {
      style: 'currency', currency: field.format?.currency ?? 'RUB',
      ...(field.format?.decimal_places !== undefined ? {
        minimumFractionDigits: field.format.decimal_places, maximumFractionDigits: field.format.decimal_places,
      } : {}),
    });
  }
  if (field.type === 'date' && typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    if (field.format?.date_input === 'iso') return raw;
    if (field.format?.date_input === 'ru') return raw.split('-').reverse().join('.');
    return new Date(`${raw}T12:00:00`).toLocaleDateString(options.locale);
  }
  return String(raw);
}
