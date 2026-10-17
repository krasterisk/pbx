import { autodialScenarioJsonSchema } from '@krasterisk/shared';
import type { FieldSchema } from './schema.types';

interface ParameterSchema { const?: unknown; enum?: unknown[] }
interface ActionSchema { properties: { type: { const: string }; params: { properties: Record<string, ParameterSchema> } } }
const contract = autodialScenarioJsonSchema() as unknown as { oneOf: ActionSchema[] };

/** Keep the reusable editor's controls within the outbound compiler contract. */
export function autodialEditorSchema(type: string, fields: FieldSchema[]): FieldSchema[] {
  const params = contract.oneOf.find((action) => action.properties.type.const === type)?.properties.params.properties ?? {};
  return fields.filter((field) => Object.hasOwn(params, field.key)).map((field) => {
    const allowed = params[field.key].enum ?? (params[field.key].const === undefined ? undefined : [params[field.key].const]);
    if (field.kind === 'value-source') {
      return { ...field, kind: field.key === 'priority' ? 'number' : 'select',
        optionsSource: field.key === 'priority' ? undefined : type === 'toqueue' ? 'queues' : 'endpoints' };
    }
    return allowed && field.options ? { ...field, options: field.options.filter((option) => allowed.includes(option.value)) } : field;
  });
}

export function autodialEditorValues(fields: FieldSchema[], values: Record<string, unknown>): Record<string, unknown> {
  const result = { ...values };
  for (const field of fields) {
    const value = values[field.key];
    if (field.kind === 'value-source' && value && typeof value === 'object' && 'source' in value) {
      result[field.key] = (value as { source: string; value?: unknown }).value ?? '';
    }
  }
  return result;
}

export function autodialEditorPatch(fields: FieldSchema[], patch: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [key,
    fields.some((field) => field.key === key && field.kind === 'value-source') && value !== undefined
      ? { source: 'fixed', value: String(value) } : value]));
}
