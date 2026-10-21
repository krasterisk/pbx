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
  it.each(['MONEY', 'DATE', 'NUMBER', 'DIGITS'])('tracks and rewrites derived %s references in all supported token forms', (format) => {
    const plan = planAutodialFields(fields, request('string').map((field) => field.uid === 2
      ? { ...field, key: 'debt', var_name: 'AC_DEBT' } : field));
    for (const wrap of [(v: string) => `{${v}}`, (v: string) => `\${${v}}`, (v: string) => `{{${v}}}`, (v: string) => `\${{${v}}}`]) {
      const token = wrap(`AC_AMOUNT_SAY_${format}`);
      const scenario = [{ params: { text: `Value: ${token}` } }];
      expect(autodialFieldReferenced(scenario, fields[1])).toBe(true);
      expect(rewriteAutodialFieldReferences(scenario, plan.renames)).toEqual([{ params: { text: `Value: ${wrap(`AC_DEBT_SAY_${format}`)}` } }]);
    }
    expect(rewriteAutodialFieldReferences(`AC_AMOUNT_SAY_${format}`, plan.renames)).toBe(`AC_DEBT_SAY_${format}`);
  });
  it('does not mistake prefixes, unsupported formats or prose for field references', () => {
    for (const text of ['{AC_AMOUNT2}', '{AC_AMOUNT_SAY_UNKNOWN}', 'amount is a field', 'AC_AMOUNT_SUFFIX']) {
      expect(autodialFieldReferenced(text, fields[1])).toBe(false);
      expect(rewriteAutodialFieldReferences(text, [{ oldKey: 'amount', key: 'debt', oldVar: 'AC_AMOUNT', variable: 'AC_DEBT' }])).toBe(text);
    }
  });
  it('renames tokens simultaneously and prefers an exact variable over a derived interpretation', () => {
    const renames = [
      { oldKey: 'a', key: 'b', oldVar: 'AC_AMOUNT', variable: 'AC_DEBT' },
      { oldKey: 'b', key: 'a', oldVar: 'AC_DEBT', variable: 'AC_AMOUNT' },
      { oldKey: 'c', key: 'd', oldVar: 'AC_AMOUNT_SAY_DATE', variable: 'AC_VISIT' },
    ];
    expect(rewriteAutodialFieldReferences('{AC_AMOUNT} {AC_DEBT_SAY_MONEY} {AC_AMOUNT_SAY_DATE}', renames))
      .toBe('{AC_DEBT} {AC_AMOUNT_SAY_MONEY} {AC_VISIT}');
  });
});
