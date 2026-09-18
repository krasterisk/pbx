import { prepareAutodialContact } from './autodial-contact.util';
import type { IAutodialBaseField } from '@krasterisk/shared';

const field = (key: string, type: IAutodialBaseField['type'], uid: number, required = false) => ({
  uid, key, type, required, is_phone: type === 'phone', enum_values: ['one', 'two'],
});
const fields = [field('name', 'string', 1, true), field('phone', 'phone', 2, true)];
const contact = { values: { name: 'Alice' }, phones: [{ raw: '8 (900) 123-45-67', uid: 21 }] };

describe('prepareAutodialContact', () => {
  it('validates a required phone in phones, preserves UID and stores field values by UID', () => {
    const result = prepareAutodialContact(fields, contact, 'ru_8_to_7');
    expect(result.values).toEqual({ '1': 'Alice' });
    expect(result.phones[0]).toMatchObject({ uid: 21, normalized: '79001234567', is_primary: true });
  });
  it('coerces imported false and zero without treating them as missing', () => {
    const result = prepareAutodialContact([field('flag', 'boolean', 3, true), field('amount', 'number', 4, true)],
      { ...contact, values: { flag: 'false', amount: '0' } }, 'digits');
    expect(result.values).toEqual({ '3': false, '4': 0 });
  });
  it.each([['number', 'Infinity'], ['number', true], ['boolean', 'maybe'], ['enum', 'three'], ['date', '2026-02-30']])(
    'rejects invalid %s value %s', (type, value) => {
      expect(() => prepareAutodialContact([field('value', type as IAutodialBaseField['type'], 1)],
        { ...contact, values: { value } }, 'digits')).toThrow();
    },
  );
  it('rejects whitespace-only required fields', () => {
    expect(() => prepareAutodialContact(fields, { ...contact, values: { name: '  ' } }, 'digits')).toThrow();
  });
  it('omits empty optional numbers instead of coercing them to zero', () => {
    expect(prepareAutodialContact([field('value', 'number', 1)],
      { ...contact, values: { value: '' } }, 'digits').values).toEqual({});
  });
  it('rejects unknown fields and missing phones', () => {
    expect(() => prepareAutodialContact(fields, { ...contact, values: { unknown: 'x' } }, 'digits')).toThrow();
    expect(() => prepareAutodialContact(fields, { ...contact, phones: [] }, 'digits')).toThrow();
  });
  it('detects duplicate normalized numbers and invalid timezone offsets', () => {
    expect(() => prepareAutodialContact(fields, { ...contact, phones: [...contact.phones, { raw: '79001234567' }] }, 'ru_8_to_7')).toThrow();
    expect(() => prepareAutodialContact(fields, { ...contact, phones: [{ raw: '123', tz_offset_min: 9999 }] }, 'digits')).toThrow();
  });
});
