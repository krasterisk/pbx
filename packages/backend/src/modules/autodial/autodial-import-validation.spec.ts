import { BadRequestException } from '@nestjs/common';
import { AutodialImportService } from './autodial-import.service';
import { coerceAutodialValue } from './autodial-contact.util';

describe('actionable import validation', () => {
  const fields = [
    { uid: 1, key: 'name', type: 'string', required: true },
    { uid: 2, key: 'active', type: 'boolean' },
    { uid: 3, key: 'visit', type: 'date' },
    { uid: 4, key: 'amount', type: 'money' },
  ];
  function setup() {
    const base = { uid: 8, revision: 3, phone_normalization: 'none', dedup_policy: 'phone' };
    const contacts = { create: jest.fn() };
    const service = new AutodialImportService(
      { findOne: jest.fn().mockResolvedValue(base) } as never,
      { findAll: jest.fn().mockResolvedValue(fields) } as never,
      contacts as never,
      { findAll: jest.fn().mockResolvedValue([]) } as never,
      {} as never, {} as never,
      { lockBase: jest.fn().mockResolvedValue(base) } as never,
      { transaction: jest.fn((write) => write({})) } as never,
    );
    const validate = (row: string) => service.importFile(71, 8, {
      buffer: Buffer.from('phone;name;active;visit;amount\n' + row),
      source: 'csv', filename: 'synthetic.csv', validation_only: true,
      expected_revision: 3,
      column_map: ['__phone', 'name', 'active', 'visit', 'amount'].map((field_key, index) => ({
        column: ['phone', 'name', 'active', 'visit', 'amount'][index], column_index: index, field_key,
      })),
    });
    return { service, contacts, validate };
  }
  it.each([
    ['00991419;Анна;возможно;2026-10-20;12,50', 'AC_INVALID_BOOL', 'active'],
    ['00991419;Анна;да;31.02.2026;12,50', 'AC_INVALID_DATE', 'visit'],
    ['00991419;Анна;да;2026-10-20;не сумма', 'AC_INVALID_NUMBER', 'amount'],
    ['00991419;;да;2026-10-20;12,50', 'AC_REQUIRED_FIELD', 'name'],
    ['не номер;Анна;да;2026-10-20;12,50', 'AC_INVALID_PHONE', '__phone'],
  ])('preserves the validation reason and field without writing contacts', async (row, message, field) => {
    const { validate, contacts } = setup();
    const result = await validate(row);
    expect(result).toMatchObject({ valid: 0, skipped: 1, ready: false,
      rejected_rows: [{ row: 2, code: 'row_invalid', message, field }] });
    expect(contacts.create).not.toHaveBeenCalled();
  });
  it('does not expose arbitrary exception text as a reason or field', async () => {
    const { service, validate } = setup();
    jest.spyOn(service as never, 'mapRow').mockImplementation(() => {
      throw new BadRequestException({ code: 'private-token=secret', field: 'private', message: 'secret' });
    });
    const result = await validate('00991419;Анна;да;2026-10-20;12,50');
    expect(result.rejected_rows[0]).toMatchObject({ code: 'row_invalid', message: 'row_invalid' });
    expect(result.rejected_rows[0]).not.toHaveProperty('field');
  });
  it('accepts Russian booleans and locale money through the same contact validator', async () => {
    const { validate } = setup();
    expect(await validate('00991419;Анна; ДА ;20.10.2026;12,50')).toMatchObject({ valid: 1, skipped: 0, ready: true });
  });
  it.each(['да', ' ДА ', 'yes', 'TRUE', '1', true, 1])('normalizes true: %s', (raw) => {
    expect(coerceAutodialValue(fields[1] as never, raw)).toBe(true);
  });
  it.each(['нет', ' НЕТ ', 'no', 'FALSE', '0', false, 0])('normalizes false: %s', (raw) => {
    expect(coerceAutodialValue(fields[1] as never, raw)).toBe(false);
  });
  it.each(['', ' ', 'возможно', 2, null, [], {}])('rejects ambiguous booleans: %s', (raw) => {
    expect(() => coerceAutodialValue(fields[1] as never, raw)).toThrow(BadRequestException);
  });
});
