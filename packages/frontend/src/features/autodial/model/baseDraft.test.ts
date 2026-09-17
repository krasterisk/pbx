import type { IAutodialBase } from '@krasterisk/shared';
import {
  baseDraftToPayload,
  baseToDraft,
  blankFieldDraft,
  emptyBaseDraft,
  hasBaseErrors,
  suggestFieldKey,
  suggestVarName,
  validateBaseDraft,
} from './baseDraft';

describe('suggestVarName', () => {
  it('prefixes and uppercases so the value survives a Local channel', () => {
    expect(suggestVarName('debt_amount')).toBe('AC_DEBT_AMOUNT');
  });

  it('returns empty for an empty key rather than a bare prefix', () => {
    expect(suggestVarName('')).toBe('');
  });
});

describe('suggestFieldKey', () => {
  it('slugifies a latin label', () => {
    expect(suggestFieldKey('Debt Amount', 0)).toBe('debt_amount');
  });

  it('falls back to a positional key when the label yields nothing valid', () => {
    expect(suggestFieldKey('ФИО клиента', 2)).toBe('field_3');
    expect(suggestFieldKey('123', 0)).toBe('field_1');
  });
});

describe('validateBaseDraft', () => {
  it('accepts the default schema once the base is named', () => {
    const errors = validateBaseDraft({ ...emptyBaseDraft(), name: 'Должники' });
    expect(hasBaseErrors(errors)).toBe(false);
  });

  it('requires a name', () => {
    expect(validateBaseDraft({ ...emptyBaseDraft(), name: '  ' }).name).toBe('required');
  });

  it('rejects a base without any phone field', () => {
    const draft = emptyBaseDraft();
    draft.fields = [
      { key: 'name', label: 'ФИО', type: 'string', required: true, is_phone: false, var_name: 'AC_NAME' },
    ];
    expect(validateBaseDraft(draft).fields).toBe('noPhone');
  });

  it('rejects an empty schema', () => {
    expect(validateBaseDraft({ ...emptyBaseDraft(), fields: [] }).fields).toBe('empty');
  });

  it('flags an invalid key and a duplicate key by index', () => {
    const draft = emptyBaseDraft();
    draft.fields = [
      { key: 'Phone', label: 'a', type: 'phone', required: false, is_phone: true, var_name: 'X' },
      { key: 'ok', label: 'b', type: 'string', required: false, is_phone: false, var_name: 'Y' },
      { key: 'ok', label: 'c', type: 'string', required: false, is_phone: false, var_name: 'Z' },
    ];
    const errors = validateBaseDraft(draft);
    expect(errors.fieldKeys).toEqual({ 0: 'pattern', 2: 'duplicate' });
  });
});

describe('baseDraftToPayload', () => {
  it('assigns positions from array order and derives is_phone from the type', () => {
    const draft = emptyBaseDraft();
    draft.fields = [
      { key: 'mobile', label: '', type: 'phone', required: false, is_phone: false, var_name: '' },
      { key: 'city', label: ' Город ', type: 'string', required: false, is_phone: false, var_name: 'AC_CITY' },
    ];
    const payload = baseDraftToPayload(draft) as {
      fields: Array<Record<string, unknown>>;
    };

    expect(payload.fields[0]).toMatchObject({
      key: 'mobile',
      position: 0,
      is_phone: true,
      label: 'mobile',
      var_name: 'AC_MOBILE',
    });
    expect(payload.fields[1]).toMatchObject({ position: 1, label: 'Город' });
  });

  it('sends enum_values only for enum fields', () => {
    const draft = emptyBaseDraft();
    draft.fields = [
      {
        key: 'segment',
        label: 'Сегмент',
        type: 'enum',
        required: false,
        is_phone: false,
        var_name: 'AC_SEGMENT',
        enum_values: ['vip', 'base'],
      },
      { key: 'phone', label: 'Тел', type: 'phone', required: true, is_phone: true, var_name: 'AC_PHONE' },
    ];
    const payload = baseDraftToPayload(draft) as { fields: Array<Record<string, unknown>> };
    expect(payload.fields[0].enum_values).toEqual(['vip', 'base']);
    expect(payload.fields[1]).not.toHaveProperty('enum_values');
  });

  it('keeps uid for existing fields so the server updates instead of recreating', () => {
    const draft = emptyBaseDraft();
    draft.fields = [{ ...draft.fields[1], uid: 42 }];
    const payload = baseDraftToPayload(draft) as { fields: Array<Record<string, unknown>> };
    expect(payload.fields[0].uid).toBe(42);
  });
});

describe('baseToDraft', () => {
  it('orders fields by position, not by array order', () => {
    const base = {
      uid: 1,
      user_uid: 1,
      name: 'Должники',
      description: '',
      dedup_policy: 'phone',
      phone_normalization: 'ru_8_to_7',
      revision: 1,
      fields: [
        { uid: 2, base_uid: 1, key: 'b', label: 'B', type: 'string', required: false, position: 5, is_phone: false, var_name: 'AC_B' },
        { uid: 1, base_uid: 1, key: 'a', label: 'A', type: 'phone', required: true, position: 1, is_phone: true, var_name: 'AC_A' },
      ],
    } as IAutodialBase;

    expect(baseToDraft(base).fields.map((f) => f.key)).toEqual(['a', 'b']);
  });
});

describe('blankFieldDraft', () => {
  it('produces a valid key and matching var name', () => {
    const field = blankFieldDraft(3);
    expect(field.key).toBe('field_4');
    expect(field.var_name).toBe('AC_FIELD_4');
    expect(validateBaseDraft({ ...emptyBaseDraft(), fields: [field] }).fieldKeys).toBeUndefined();
  });
});
