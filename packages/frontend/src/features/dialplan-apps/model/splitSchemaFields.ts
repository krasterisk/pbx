import type { FieldSchema } from './schema.types';

export type SchemaFieldGroup = 'primary' | 'params';

export function splitSchemaFields(schema: FieldSchema[]): {
  primary: FieldSchema[];
  params: FieldSchema[];
} {
  const usable = schema.filter(
    (field) => !(field.key === 'options' && (field.kind === 'text' || field.kind === undefined)),
  );
  const hasExplicit = usable.some((field) => field.group === 'primary' || field.group === 'params');

  let primary: FieldSchema[];
  let params: FieldSchema[];

  if (hasExplicit) {
    primary = usable.filter(
      (field) => field.group === 'primary' || (field.group == null && field.required),
    );
    params = usable.filter(
      (field) => field.group === 'params' || (field.group == null && !field.required),
    );
  } else {
    primary = usable.filter((field) => field.required);
    params = usable.filter((field) => !field.required);
    if (primary.length === 0) {
      return { primary: usable, params: [] };
    }
  }

  return coalesceSchemaSections(primary, params);
}

/** One collapsible block when the split would show tiny single-field sections. */
export function coalesceSchemaSections(
  primary: FieldSchema[],
  params: FieldSchema[],
): { primary: FieldSchema[]; params: FieldSchema[] } {
  if (params.length === 0 || primary.length === 0) {
    return { primary, params };
  }
  const total = primary.length + params.length;
  if (total <= 4) {
    return { primary: [...primary, ...params], params: [] };
  }
  return { primary, params };
}
