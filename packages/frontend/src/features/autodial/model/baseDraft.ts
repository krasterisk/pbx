import type {
  AutodialDedupPolicy,
  AutodialFieldType,
  AutodialPhoneNormalization,
  IAutodialBase,
  IAutodialBaseField,
  CreateAutodialBaseInput,
} from '@krasterisk/shared';

export type AutodialFieldDraft = Pick<
  IAutodialBaseField,
  'key' | 'label' | 'type' | 'required' | 'is_phone' | 'var_name'
> & { uid?: number; enum_values?: string[] | null };

export interface AutodialBaseDraft {
  revision?: number;
  name: string;
  description: string;
  dedup_policy: AutodialDedupPolicy;
  phone_normalization: AutodialPhoneNormalization;
  fields: AutodialFieldDraft[];
}

/** Backend guard: `^[a-z][a-z0-9_]{0,62}$`. Kept in sync deliberately. */
export const AUTODIAL_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;

/** Dialplan variable names are uppercased and prefixed so they survive Local channels. */
export function suggestVarName(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
  return cleaned ? `AC_${cleaned}` : '';
}

/** Turn a human label into a valid field key: "Дата визита" → "data_vizita" is not
 * attempted — transliteration is guesswork; instead fall back to a positional key. */
export function suggestFieldKey(label: string, position: number): string {
  const ascii = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return AUTODIAL_FIELD_KEY_PATTERN.test(ascii) ? ascii : `field_${position + 1}`;
}

export function emptyBaseDraft(): AutodialBaseDraft {
  return {
    name: '',
    description: '',
    dedup_policy: 'phone',
    phone_normalization: 'ru_8_to_7',
    fields: [
      {
        key: 'name',
        label: 'ФИО',
        type: 'string',
        required: true,
        is_phone: false,
        var_name: 'AC_NAME',
      },
      {
        key: 'phone',
        label: 'Телефон',
        type: 'phone',
        required: true,
        is_phone: true,
        var_name: 'AC_PHONE',
      },
    ],
  };
}

export function baseToDraft(base: IAutodialBase): AutodialBaseDraft {
  return {
    revision: base.revision,
    name: base.name,
    description: base.description ?? '',
    dedup_policy: base.dedup_policy,
    phone_normalization: base.phone_normalization,
    fields: (base.fields ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((f) => ({
        uid: f.uid,
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        is_phone: f.is_phone,
        var_name: f.var_name,
        enum_values: f.enum_values ?? null,
      })),
  };
}

export function blankFieldDraft(position: number): AutodialFieldDraft {
  const key = `field_${position + 1}`;
  return {
    key,
    label: '',
    type: 'string',
    required: false,
    is_phone: false,
    var_name: suggestVarName(key),
  };
}

export interface BaseDraftErrors {
  name?: string;
  fields?: string;
  /** Keyed by field index. */
  fieldKeys?: Record<number, string>;
}

export function validateBaseDraft(draft: AutodialBaseDraft): BaseDraftErrors {
  const errors: BaseDraftErrors = {};
  if (!draft.name.trim()) errors.name = 'required';

  const fieldKeys: Record<number, string> = {};
  const seen = new Set<string>();
  draft.fields.forEach((field, index) => {
    if (!AUTODIAL_FIELD_KEY_PATTERN.test(field.key)) fieldKeys[index] = 'pattern';
    else if (seen.has(field.key)) fieldKeys[index] = 'duplicate';
    else seen.add(field.key);
  });
  if (Object.keys(fieldKeys).length) errors.fieldKeys = fieldKeys;

  // A base with no phone field can never produce a dialable task.
  const hasPhone = draft.fields.some((f) => f.is_phone || f.type === 'phone');
  if (draft.fields.length === 0) errors.fields = 'empty';
  else if (!hasPhone) errors.fields = 'noPhone';

  return errors;
}

export function hasBaseErrors(errors: BaseDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function baseDraftToPayload(draft: AutodialBaseDraft): CreateAutodialBaseInput & { revision?: number } {
  return {
    ...(draft.revision !== undefined ? { revision: draft.revision } : {}),
    name: draft.name.trim(),
    description: draft.description.trim(),
    dedup_policy: draft.dedup_policy,
    phone_normalization: draft.phone_normalization,
    fields: draft.fields.map((field, position) => ({
      ...(field.uid ? { uid: field.uid } : {}),
      key: field.key,
      label: field.label.trim() || field.key,
      type: field.type,
      required: field.required,
      position,
      is_phone: field.is_phone || field.type === 'phone',
      var_name: field.var_name || suggestVarName(field.key),
      ...(field.type === 'enum' ? { enum_values: field.enum_values ?? [] } : {}),
    })),
  };
}

export const AUTODIAL_FIELD_TYPE_ORDER: AutodialFieldType[] = [
  'string',
  'phone',
  'number',
  'boolean',
  'date',
  'money',
  'enum',
];
