import { BadRequestException } from '@nestjs/common';
import type { AutodialFieldInput, IAutodialBaseField } from '@krasterisk/shared';
import { fieldKeyToVarName } from './autodial-phone.util';
import { coerceAutodialValue } from './autodial-contact.util';

export function planAutodialFields(old: IAutodialBaseField[], requested: AutodialFieldInput[]) {
  const byUid = new Map(old.map((field) => [field.uid, field]));
  const byKey = new Map(old.map((field) => [field.key, field]));
  const ids = new Set<number>(); const keys = new Set<string>(); const vars = new Set<string>();
  const fields = requested.map((field, position) => {
    const previous = field.uid === undefined ? byKey.get(field.key) : byUid.get(field.uid);
    if (field.uid !== undefined && !previous) throw new BadRequestException({ code: 'AC_FIELD_UID' });
    if (previous && ids.has(previous.uid)) throw new BadRequestException({ code: 'AC_FIELD_DUP' });
    if (previous) ids.add(previous.uid);
    if (keys.has(field.key)) throw new BadRequestException({ code: 'AC_FIELD_DUP' }); keys.add(field.key);
    const variable = field.var_name || fieldKeyToVarName(field.key);
    if (vars.has(variable)) throw new BadRequestException({ code: 'AC_FIELD_VAR_DUP' }); vars.add(variable);
    if (byKey.has(field.key) && byKey.get(field.key)?.uid !== previous?.uid) throw new BadRequestException({ code: 'AC_FIELD_KEY_IN_USE' });
    const isPhone = field.type === 'phone' || field.is_phone === true;
    if (previous && (previous.is_phone || previous.type === 'phone') !== isPhone) throw new BadRequestException({ code: 'AC_SYSTEM_FIELD', message: 'Phone identity cannot be converted into a data field' });
    return { ...field, uid: previous?.uid, required: field.required ?? false, is_phone: isPhone,
      var_name: variable, position: field.position ?? position, format: field.format ?? null,
      enum_values: field.type === 'enum' ? field.enum_values ?? [] : null };
  });
  const removed = old.filter((field) => !ids.has(field.uid));
  if (removed.some((field) => field.is_phone || field.type === 'phone') || !fields.some((field) => field.is_phone)) {
    throw new BadRequestException({ code: 'AC_SYSTEM_FIELD', message: 'Keep the system phone field' });
  }
  const renames = fields.flatMap((field) => {
    const previous = field.uid ? byUid.get(field.uid) : undefined;
    return previous && (previous.key !== field.key || previous.var_name !== field.var_name)
      ? [{ oldKey: previous.key, key: field.key, oldVar: previous.var_name, variable: field.var_name }] : [];
  });
  return { fields, removed, renames };
}

export function convertAutodialSchemaValues(raw: Record<string, string | number | boolean>, old: IAutodialBaseField[],
  plan: ReturnType<typeof planAutodialFields>, defaults: Record<string, string | number | boolean> = {}, policy: 'reject' | 'archive_omit' = 'reject') {
  const valuesByKey: Record<string, string | number | boolean> = {};
  const errors: Array<{ field: string; code: string }> = [];
  const archives: Array<{ field: IAutodialBaseField; value: unknown }> = [];
  for (const field of plan.fields) {
    if (field.is_phone) continue;
    const previous = old.find((item) => item.uid === field.uid);
    const before = previous ? raw[String(previous.uid)] : undefined;
    const value = before == null || before === '' ? defaults[field.key] ?? before : before;
    try {
      if (value === undefined || value === '') {
        if (field.required) throw new BadRequestException({ code: 'AC_REQUIRED_FIELD' });
      } else valuesByKey[field.key] = coerceAutodialValue({ ...field, uid: field.uid ?? 0 }, value);
    } catch (error) {
      if (field.required || policy !== 'archive_omit') errors.push({ field: field.key,
        code: (error as { response?: { code?: string } }).response?.code ?? 'AC_INVALID_VALUE' });
    }
    if (previous && before !== undefined && (previous.type !== field.type || !Object.is(before, valuesByKey[field.key]))) archives.push({ field: previous, value: before });
  }
  for (const field of plan.removed) if (raw[String(field.uid)] !== undefined) archives.push({ field, value: raw[String(field.uid)] });
  return { valuesByKey, archives, errors };
}

const SPEECH_SUFFIXES = new Set(['_SAY_MONEY', '_SAY_DATE', '_SAY_NUMBER', '_SAY_DIGITS']);
const FIELD_TOKEN = /\$?\{\{?(AC_[A-Z0-9_]+)\}\}?/g;

/** Exact variables win over derived tokens; unknown suffixes are ordinary text. */
function variableSuffix(name: string, variable: string): string | null {
  if (name === variable) return '';
  const suffix = name.startsWith(variable) ? name.slice(variable.length) : '';
  return SPEECH_SUFFIXES.has(suffix) ? suffix : null;
}

export function autodialFieldReferenced(value: unknown, field: Pick<IAutodialBaseField, 'key' | 'var_name'>): boolean {
  if (typeof value === 'string') {
    return variableSuffix(value, field.var_name) !== null
      || [...value.matchAll(FIELD_TOKEN)].some((match) => variableSuffix(match[1], field.var_name) !== null);
  }
  if (Array.isArray(value)) return value.some((item) => autodialFieldReferenced(item, field));
  if (value && typeof value === 'object') return Object.entries(value).some(([key, item]) =>
    (key === 'field_key' && item === field.key) || autodialFieldReferenced(item, field));
  return false;
}

export function rewriteAutodialFieldReferences<T>(value: T, renames: ReturnType<typeof planAutodialFields>['renames'], property?: string): T;
export function rewriteAutodialFieldReferences(value: unknown, renames: ReturnType<typeof planAutodialFields>['renames'], property?: string): unknown {
  if (typeof value === 'string') {
    if (property === 'field_key') {
      const rename = renames.find((item) => item.oldKey === value);
      if (rename) return rename.key;
    }
    const rewriteVariable = (name: string) => {
      const rename = renames.find((item) => item.oldVar === name)
        ?? renames.find((item) => variableSuffix(name, item.oldVar) !== null);
      return rename ? rename.variable + variableSuffix(name, rename.oldVar)! : name;
    };
    const standalone = rewriteVariable(value);
    if (standalone !== value) return standalone;
    return value.replace(FIELD_TOKEN, (token, name: string) => {
      return token.replace(name, rewriteVariable(name));
    });
  }
  if (Array.isArray(value)) return value.map((item) => rewriteAutodialFieldReferences(item, renames));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, rewriteAutodialFieldReferences(item, renames, key)]));
  return value;
}
