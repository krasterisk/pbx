import type { IAutodialBaseField } from '@krasterisk/shared';
import { buildAutoColumnMap, SPECIAL_IMPORT_TARGETS } from './importMapping';

function field(over: Partial<IAutodialBaseField>): IAutodialBaseField {
  return {
    uid: 1,
    base_uid: 1,
    key: 'name',
    label: 'ФИО',
    type: 'string',
    required: false,
    position: 0,
    is_phone: false,
    var_name: 'AC_NAME',
    ...over,
  };
}

describe('buildAutoColumnMap', () => {
  const fields = [
    field({ uid: 1, key: 'name', label: 'ФИО' }),
    field({ uid: 2, key: 'phone', label: 'Телефон', type: 'phone', is_phone: true }),
    field({ uid: 3, key: 'debt', label: 'Долг', type: 'money' }),
  ];

  it('matches a header against the field key, case-insensitively', () => {
    const map = buildAutoColumnMap(['Name', 'DEBT'], fields);
    expect(map).toEqual([
      { column: 'Name', field_key: 'name', transform: 'trim' },
      { column: 'DEBT', field_key: 'debt', transform: 'trim' },
    ]);
  });

  it('matches a header against the field label', () => {
    const map = buildAutoColumnMap(['Долг'], fields);
    expect(map[0]).toMatchObject({ column: 'Долг', field_key: 'debt' });
  });

  it('routes a phone field to __phone with normalization', () => {
    const map = buildAutoColumnMap(['Телефон'], fields);
    expect(map[0]).toEqual({
      column: 'Телефон',
      field_key: '__phone',
      transform: 'phone_normalize',
    });
  });

  it('guesses a phone column from a keyword when no field matches', () => {
    const map = buildAutoColumnMap(['mobile_number'], [fields[0]]);
    expect(map[0]).toMatchObject({ field_key: '__phone' });
  });

  it('claims only the first phone-looking column', () => {
    const map = buildAutoColumnMap(['phone', 'phone2'], [fields[0]]);
    expect(map.filter((m) => m.field_key === '__phone')).toHaveLength(1);
  });

  it('does not map one field to two columns', () => {
    const map = buildAutoColumnMap(['name', 'name'], fields);
    expect(map).toHaveLength(1);
  });

  it('recognises an exact id header as the external id', () => {
    const map = buildAutoColumnMap(['id'], fields);
    expect(map[0]).toMatchObject({ field_key: '__external_id' });
  });

  it('leaves an unrecognised column unmapped instead of guessing', () => {
    expect(buildAutoColumnMap(['какая-то_колонка'], fields)).toEqual([]);
  });

  it('exposes the four special targets the importer understands', () => {
    expect([...SPECIAL_IMPORT_TARGETS]).toEqual([
      '__phone',
      '__external_id',
      '__tz_offset',
      '__comment',
    ]);
  });
});
