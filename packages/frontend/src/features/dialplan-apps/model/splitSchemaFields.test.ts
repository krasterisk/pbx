import { describe, it, expect } from 'vitest';
import { splitSchemaFields, coalesceSchemaSections } from './splitSchemaFields';
import type { FieldSchema } from './schema.types';

describe('splitSchemaFields', () => {
  it('puts required fields in primary and the rest in params by default', () => {
    const schema: FieldSchema[] = [
      { key: 'trunk', kind: 'select', required: true, labelKey: 'trunk' },
      { key: 'timeout', kind: 'duration', labelKey: 'timeout' },
      { key: 'options', kind: 'text', labelKey: 'options' },
      { key: 'rewrite', kind: 'custom', labelKey: 'rewrite' },
      { key: 'extra', kind: 'text', labelKey: 'extra' },
      { key: 'more', kind: 'text', labelKey: 'more' },
    ];
    expect(splitSchemaFields(schema)).toEqual({
      primary: [schema[0]],
      params: [schema[1], schema[3], schema[4], schema[5]],
    });
  });

  it('keeps custom options fields in params when section is large enough', () => {
    const schema: FieldSchema[] = [
      { key: 'files', kind: 'select', required: true, group: 'primary', labelKey: 'files' },
      { key: 'mode', kind: 'mode', group: 'primary', labelKey: 'mode' },
      { key: 'target', kind: 'text', group: 'params', labelKey: 'target' },
      { key: 'options', kind: 'custom', group: 'params', labelKey: 'options' },
      { key: 'timeout', kind: 'duration', group: 'params', labelKey: 'timeout' },
    ];
    expect(splitSchemaFields(schema)).toEqual({
      primary: [schema[0], schema[1]],
      params: [schema[2], schema[3], schema[4]],
    });
  });

  it('puts everything in primary when nothing is required', () => {
    const schema: FieldSchema[] = [
      { key: 'a', kind: 'text', labelKey: 'a' },
      { key: 'b', kind: 'text', labelKey: 'b' },
    ];
    expect(splitSchemaFields(schema)).toEqual({
      primary: schema,
      params: [],
    });
  });

  it('merges tiny split sections into one block', () => {
    const primary: FieldSchema[] = [
      { key: 'context', kind: 'select', required: true, group: 'primary', labelKey: 'context' },
    ];
    const params: FieldSchema[] = [
      { key: 'extension', kind: 'value-source', group: 'params', labelKey: 'extension' },
      { key: 'rewrite', kind: 'custom', group: 'params', labelKey: 'rewrite' },
    ];
    expect(coalesceSchemaSections(primary, params)).toEqual({
      primary: [...primary, ...params],
      params: [],
    });
  });
});
