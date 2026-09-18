import { BadRequestException } from '@nestjs/common';
import type {
  AutodialPhoneNormalization,
  CreateAutodialContactInput,
  IAutodialBaseField,
} from '@krasterisk/shared';
import { normalizeAutodialPhone } from './autodial-phone.util';

type Field = Pick<IAutodialBaseField, 'uid' | 'key' | 'type' | 'required' | 'is_phone' | 'enum_values'>;

function invalid(code: string, field: string): never {
  throw new BadRequestException({ code, field, message: code });
}

export function coerceAutodialValue(field: Field, raw: unknown): string | number | boolean {
  if (!['string', 'number', 'boolean'].includes(typeof raw)) invalid('AC_INVALID_VALUE', field.key);
  switch (field.type) {
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      if (raw === '1' || raw === 1 || raw === 'true' || raw === 'yes') return true;
      if (raw === '0' || raw === 0 || raw === 'false' || raw === 'no') return false;
      return invalid('AC_INVALID_BOOL', field.key);
    case 'number':
    case 'money': {
      if (typeof raw === 'boolean' || !String(raw).trim()) invalid('AC_INVALID_NUMBER', field.key);
      const value = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(value)) invalid('AC_INVALID_NUMBER', field.key);
      return value;
    }
    case 'enum': {
      const value = String(raw);
      if (!field.enum_values?.includes(value)) invalid('AC_INVALID_ENUM', field.key);
      return value;
    }
    case 'date': {
      const value = String(raw);
      const parsed = new Date(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime())
        || parsed.toISOString().slice(0, 10) !== value) invalid('AC_INVALID_DATE', field.key);
      return value;
    }
    default:
      return String(raw);
  }
}

/** The manual editor and import use the same validation and stored UID mapping. */
export function prepareAutodialContact(
  fields: Field[],
  dto: CreateAutodialContactInput,
  normalization: AutodialPhoneNormalization,
) {
  if (!Array.isArray(dto.phones) || !dto.phones.length) invalid('AC_PHONES_REQUIRED', 'phones');
  if (!dto.values || typeof dto.values !== 'object' || Array.isArray(dto.values)) {
    invalid('AC_INVALID_VALUE', 'values');
  }
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const values: Record<string, string | number | boolean> = {};
  for (const [key, raw] of Object.entries(dto.values)) {
    const field = byKey.get(key);
    if (!field) invalid('AC_UNKNOWN_FIELD', key);
    // Phone fields are represented by phones, never a second, divergent value.
    if (field.is_phone || field.type === 'phone') continue;
    if (raw === '') {
      if (field.required) invalid('AC_REQUIRED_FIELD', key);
      continue;
    }
    values[String(field.uid)] = coerceAutodialValue(field, raw);
  }
  for (const field of fields) {
    if (field.is_phone || field.type === 'phone') continue;
    const value = values[String(field.uid)];
    if (field.required && (value === undefined || (typeof value === 'string' && !value.trim()))) {
      invalid('AC_REQUIRED_FIELD', field.key);
    }
  }
  const seen = new Set<string>();
  const phones = dto.phones.map((phone, position) => {
    if (typeof phone.raw !== 'string') invalid('AC_INVALID_PHONE', 'phones');
    const normalized = normalizeAutodialPhone(phone.raw, normalization);
    if (!normalized) invalid('AC_INVALID_PHONE', 'phones');
    if (seen.has(normalized)) invalid('AC_DUPLICATE_PHONE', 'phones');
    seen.add(normalized);
    const offset = phone.tz_offset_min ?? 180;
    if (!Number.isInteger(offset) || offset < -720 || offset > 840) invalid('AC_INVALID_TIMEZONE_OFFSET', 'phones');
    return {
      ...(phone.uid !== undefined ? { uid: phone.uid } : {}),
      raw: phone.raw.trim(),
      normalized,
      is_primary: phone.is_primary ?? false,
      tz_offset_min: offset,
      position,
    };
  });
  const primary = Math.max(0, phones.findIndex((phone) => phone.is_primary));
  phones.forEach((phone, index) => { phone.is_primary = index === primary; });
  return { external_id: dto.external_id?.trim() || null, values, phones };
}
