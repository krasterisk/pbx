import * as ExcelJS from 'exceljs';
import { AutodialImportService } from './autodial-import.service';

// Parser methods do not need models or a database connection.
const importer = Object.create(AutodialImportService.prototype) as AutodialImportService;
describe('autodial import preview parser', () => {
  it('splits multiple destinations before applying phone normalization', () => {
    const mapped = importer['mapRow'](['phone'], ['000505, 000602'], [
      { column: 'phone', field_key: '__phone', transform: 'phone_normalize' },
    ], [], 'digits');
    expect(mapped.phones.map((phone) => phone.normalized)).toEqual(['000505', '000602']);
  });
  it('omits invalid optional values only by explicit policy and returns the original value', () => {
    const fields = [{ uid: 1, key: 'debt', type: 'money', required: false }] as never;
    const map = [{ column: 'phone', field_key: '__phone' }, { column: 'debt', field_key: 'debt' }];
    expect(() => importer['mapRow'](['phone', 'debt'], ['123', 'unknown'], map, fields, 'digits')).toThrow();
    const mapped = importer['mapRow'](['phone', 'debt'], ['123', 'unknown'], map, fields, 'digits', 'omit');
    expect(mapped.values).toEqual({});
    expect(mapped.warnings).toEqual([{ field: 'debt', value: 'unknown', code: 'AC_INVALID_NUMBER' }]);
  });
  it('rejects a nonempty invalid secondary phone instead of silently dropping it', () => {
    expect(() => importer['mapRow'](['phone', 'phone2'], ['79001234567', 'invalid'], [
      { column: 'phone', column_index: 0, field_key: '__phone' },
      { column: 'phone2', column_index: 1, field_key: '__phone', transform: 'phone_normalize' },
    ], [], 'ru_8_to_7')).toThrow();
  });
  it('rejects an invalid timezone offset instead of defaulting it', () => {
    expect(() => importer['mapRow'](['phone', 'tz'], ['79001234567', 'invalid'], [
      { column: 'phone', field_key: '__phone' }, { column: 'tz', field_key: '__tz_offset' },
    ], [], 'ru_8_to_7')).toThrow();
  });
  it('honours an explicit delimiter and a file without a header', async () => {
    expect(await importer.previewCsv(Buffer.from('Alice|123\nBob|456'), { delimiter: '|', has_header: false }))
      .toEqual({ headers: ['0', '1'], sample_rows: [['Alice', '123'], ['Bob', '456']], delimiter: '|', total_rows: 2 });
  });
  it('preserves duplicate headers for index-based mapping', async () => {
    expect((await importer.previewCsv(Buffer.from('phone;phone\n123;456'))).headers).toEqual(['phone', 'phone']);
  });
  it('parses quoted newlines and escaped quotes', async () => {
    const result = await importer.previewCsv(Buffer.from('name;phone\n"Alice\n""Second""";123'));
    expect(result.sample_rows).toEqual([['Alice\n"Second"', '123']]);
  });
  it('rejects malformed CSV and unsupported delimiters', async () => {
    await expect(importer.previewCsv(Buffer.from('name;phone\n"Alice;123'))).rejects.toThrow();
    await expect(importer.previewCsv(Buffer.from('name;phone'), { delimiter: 'xx' })).rejects.toThrow();
  });
  it('includes the first XLSX row when there is no header', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Contacts');
    sheet.addRows([['Alice', '123'], ['Bob', '456']]);
    const result = await importer.previewXlsx(Buffer.from(await workbook.xlsx.writeBuffer()), { has_header: false });
    expect(result).toMatchObject({ headers: ['0', '1'], total_rows: 2, sample_rows: [['Alice', '123'], ['Bob', '456']] });
  });
  it('uses the same civil dates, cached formulas and leading-zero identifiers in preview and import', async () => {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Contacts');
    sheet.addRow(['date', 'phone', 'sum']);
    sheet.addRow([new Date('2026-10-16T00:00:00Z'), 505, { formula: '2+2', result: 4 }]);
    sheet.getCell('B2').numFmt = '000000';
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    expect((await importer.previewXlsx(buffer)).sample_rows).toEqual([['2026-10-16', '000505', '4']]);
    expect((await importer['readAllXlsx'](buffer)).slice(1)).toEqual([['2026-10-16', '000505', '4']]);
  });
});
