import type { IAutodialBaseField } from '@krasterisk/shared';
import { autodialFieldReferenced, convertAutodialSchemaValues, planAutodialFields, rewriteAutodialFieldReferences } from './autodial-schema.util';

const fields: IAutodialBaseField[] = [
  { uid: 1, base_uid: 8, key: 'phone', label: 'Phone', type: 'phone', is_phone: true, required: true, position: 0, var_name: 'AC_PHONE' },
  { uid: 2, base_uid: 8, key: 'amount', label: 'Amount', type: 'string', is_phone: false, required: false, position: 1, var_name: 'AC_AMOUNT' },
];
const request = (type: 'string' | 'money' = 'money') => fields.map(({ base_uid: _baseUid, ...field }) => field.uid === 2 ? { ...field, type } : field);

describe('explicit schema migration planning', () => {
  it('converts a localized amount and archives the original value', () => {
    const plan = planAutodialFields(fields, request());
    const result = convertAutodialSchemaValues({ '2': '15 240,50', orphan: 'retained by apply' }, fields, plan);
    expect(result.valuesByKey).toEqual({ amount: 15240.5 });
    expect(result.archives).toEqual([{ field: fields[1], value: '15 240,50' }]);
    expect(result.errors).toEqual([]);
  });
  it('requires an explicit archive policy to omit invalid optional values', () => {
    const plan = planAutodialFields(fields, request());
    expect(convertAutodialSchemaValues({ '2': 'unknown' }, fields, plan).errors).toHaveLength(1);
    const omitted = convertAutodialSchemaValues({ '2': 'unknown' }, fields, plan, {}, 'archive_omit');
    expect(omitted).toMatchObject({ errors: [], valuesByKey: {} });
    expect(omitted.archives[0].value).toBe('unknown');
    plan.fields[1].required = true;
    expect(convertAutodialSchemaValues({ '2': 'unknown' }, fields, plan, {}, 'archive_omit').errors).toHaveLength(1);
  });
  it('keeps system phone identity and rejects duplicate variables', () => {
    expect(() => planAutodialFields(fields, request().slice(1))).toThrow();
    expect(() => planAutodialFields(fields, request().map((field) => ({ ...field, var_name: 'AC_PHONE' })))).toThrow();
  });
  it('rewrites known variable tokens and structured field keys without replacing ordinary words', () => {
    const plan = planAutodialFields(fields, request('string').map((field) => field.uid === 2 ? { ...field, key: 'debt', var_name: 'AC_DEBT' } : field));
    const original = { text: 'amount: {AC_AMOUNT}, ${AC_AMOUNT}, {{AC_AMOUNT}}', key: { field_key: 'amount' } };
    expect(autodialFieldReferenced(original, fields[1])).toBe(true);
    expect(rewriteAutodialFieldReferences(original, plan.renames)).toEqual({ text: 'amount: {AC_DEBT}, ${AC_DEBT}, {{AC_DEBT}}', key: { field_key: 'debt' } });
  });
});
