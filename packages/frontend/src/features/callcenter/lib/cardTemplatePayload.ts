import type { ICardField } from '../model/types/callCard';

/** Body of one card field. Server-only columns (`uid`, `template_id`, `user_uid`) are not accepted on write. */
export function toCardFieldPayload(field: ICardField, sortOrder: number) {
  return {
    field_key: field.field_key,
    field_type: field.field_type,
    label: field.label,
    placeholder: field.placeholder ?? '',
    is_required: Boolean(field.is_required),
    default_value: field.default_value ?? '',
    options: field.options ?? null,
    depends_on: field.depends_on ?? null,
    depends_values: field.depends_values ?? null,
    sort_order: sortOrder,
    width: field.width ?? 'full',
    auto_populate: field.auto_populate ?? null,
  };
}

/** class-validator dumps are not something a supervisor can act on. */
export function cardTemplateErrorText(message: unknown, fallback: string): string {
  const parts = (Array.isArray(message) ? message : message ? [message] : [])
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
  const raw = parts.join(' ');
  if (!raw || /should not exist|must be |Validation failed/i.test(raw)) return fallback;
  return parts.join(' ');
}
