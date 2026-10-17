import type { IAutodialBaseField } from '@krasterisk/shared';
import { autodialSpeech, type AutodialSpeechKind } from './autodial-speech.util';

/** Preserve legacy field values; new phone fields resolve from the dialed phone. */
export function autodialContactVariables(
  fields: Pick<IAutodialBaseField, 'uid' | 'type' | 'is_phone' | 'var_name' | 'format'>[],
  values: Record<string, string | number | boolean>,
  number: string,
  speech = false,
): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const field of fields) {
    const value = values[String(field.uid)]
      ?? (field.is_phone || field.type === 'phone' ? number : undefined);
    if (value == null) continue;
    variables[`__${field.var_name}`] = String(value).replace(/[\r\n,]/g, ' ').slice(0, 255);
    if (speech) for (const kind of ['money', 'date', 'number', 'digits'] as AutodialSpeechKind[]) {
      try { variables[`__${field.var_name}_SAY_${kind.toUpperCase()}`] = autodialSpeech(value, kind, field.format?.currency ?? 'RUB'); }
      catch { /* Missing or incompatible values stay absent, and preview reports the missing variable. */ }
    }
  }
  return variables;
}
