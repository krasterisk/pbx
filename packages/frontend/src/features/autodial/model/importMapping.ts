import type { IAutodialBaseField, IAutodialColumnMap } from '@krasterisk/shared';

/** Targets that are not schema fields — the importer treats them specially. */
export const SPECIAL_IMPORT_TARGETS = [
  '__phone',
  '__external_id',
  '__tz_offset',
  '__comment',
] as const;

const PHONE_HEADER_HINTS = [
  'phone',
  'tel',
  'mobile',
  'msisdn',
  'номер',
  'телефон',
  'моб',
  'сот',
];

const EXTERNAL_ID_HINTS = ['id', 'external', 'внешний', 'код', 'клиент_id'];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * First-pass column mapping so the wizard opens with something sensible rather
 * than an all-"skip" grid. Exact field key or label wins; otherwise a phone or
 * external-id header is guessed by keyword.
 */
export function buildAutoColumnMap(
  headers: string[],
  fields: IAutodialBaseField[],
): IAutodialColumnMap[] {
  const byKey = new Map(fields.map((f) => [f.key.toLowerCase(), f]));
  const byLabel = new Map(fields.map((f) => [normalizeHeader(f.label), f]));
  const usedFieldKeys = new Set<string>();
  const map: IAutodialColumnMap[] = [];
  let phoneMapped = false;

  for (const [column_index, header] of headers.entries()) {
    const normalized = normalizeHeader(header);
    const exact = byKey.get(normalized) ?? byLabel.get(normalized);

    if (exact && !usedFieldKeys.has(exact.key)) {
      usedFieldKeys.add(exact.key);
      const isPhone = exact.is_phone || exact.type === 'phone';
      if (isPhone) phoneMapped = true;
      map.push({
        column: header,
        column_index,
        field_key: isPhone ? '__phone' : exact.key,
        transform: isPhone ? 'phone_normalize' : 'trim',
      });
      continue;
    }

    if (!phoneMapped && PHONE_HEADER_HINTS.some((hint) => normalized.includes(hint))) {
      phoneMapped = true;
      map.push({ column: header, column_index, field_key: '__phone', transform: 'phone_normalize' });
      continue;
    }

    if (EXTERNAL_ID_HINTS.some((hint) => normalized === hint)) {
      map.push({ column: header, column_index, field_key: '__external_id', transform: 'trim' });
    }
  }

  return map;
}
