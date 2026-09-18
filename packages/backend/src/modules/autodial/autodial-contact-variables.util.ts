import type { IAutodialBaseField } from '@krasterisk/shared';

/** Preserve legacy field values; new phone fields resolve from the dialed phone. */
export function autodialContactVariables(
  fields: Pick<IAutodialBaseField, 'uid' | 'type' | 'is_phone' | 'var_name'>[],
  values: Record<string, string | number | boolean>,
  number: string,
): Record<string, string> {
  const variables: Record<string, string> = {};
  for (const field of fields) {
    const value = values[String(field.uid)]
      ?? (field.is_phone || field.type === 'phone' ? number : undefined);
    if (value == null) continue;
    variables[`__${field.var_name}`] = String(value).replace(/[\r\n,]/g, ' ').slice(0, 255);
  }
  return variables;
}
