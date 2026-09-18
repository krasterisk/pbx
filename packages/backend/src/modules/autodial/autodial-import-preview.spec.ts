import * as ExcelJS from 'exceljs';
import { AutodialImportService } from './autodial-import.service';

// Parser methods do not need models or a database connection.
const importer = Object.create(AutodialImportService.prototype) as AutodialImportService;
describe('autodial import preview parser', () => {
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
});
