import { describe, expect, it } from 'vitest';
import { autodialEditorPatch, autodialEditorSchema, autodialEditorValues } from './autodialSchema';
import type { FieldSchema } from './schema.types';

describe('outbound editor uses the runtime contract', () => {
  it('hides unsupported input modes and unknown parameters', () => {
    const fields = autodialEditorSchema('collect_input', [
      { key: 'mode', kind: 'mode', options: [{ value: 'digits', labelKey: 'd' }, { value: 'extension', labelKey: 'e' }] },
      { key: 'unknown', kind: 'text' },
    ] as FieldSchema[]);
    expect(fields).toHaveLength(1);
    expect(fields[0].options?.map((option) => option.value)).toEqual(['digits']);
  });
  it('restricts queue destinations to catalog values without changing the stored shape', () => {
    const fields = [{ key: 'target', kind: 'value-source' }] as FieldSchema[];
    expect(autodialEditorSchema('toqueue', fields)[0]).toMatchObject({ kind: 'select', optionsSource: 'queues' });
    expect(autodialEditorValues(fields, { target: { source: 'fixed', value: 'sales' } })).toEqual({ target: 'sales' });
    expect(autodialEditorPatch(fields, { target: 'support' })).toEqual({ target: { source: 'fixed', value: 'support' } });
  });
});
