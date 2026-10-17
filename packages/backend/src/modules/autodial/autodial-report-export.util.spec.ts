import ExcelJS from 'exceljs';
import { buildAutodialXlsx } from './autodial-report-export.util';
describe('Autodial XLSX provenance and formats', () => {
  it('exports typed local dates, literal untrusted strings and percentages without scaling', async () => {
    const buffer = await buildAutodialXlsx('detail', [{ key: 'started_at', header: 'Started' }, { key: 'contact_rate', header: 'Rate, %' }, { key: 'name', header: 'Name' }],
      [{ started_at: '2026-10-16T17:30:00Z', contact_rate: 50, name: '=HYPERLINK("https://example.invalid")' }],
      { tenant: 71, from: '2026-10-17', to: '2026-10-17', timezone: 'Asia/Krasnoyarsk' });
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer as never); const sheet = wb.worksheets[0];
    expect(sheet.getCell('A1').value).toBe('Started (Asia/Krasnoyarsk)');
    expect((sheet.getCell('A2').value as Date).toISOString()).toBe('2026-10-17T00:30:00.000Z');
    expect(sheet.getCell('A2').numFmt).toBe('dd.mm.yyyy hh:mm:ss');
    expect(sheet.getCell('B2').value).toBe(50); expect(sheet.getCell('B2').numFmt).toBe('0.00"%"');
    expect(sheet.getCell('C2').value).toBe('=HYPERLINK("https://example.invalid")');
    expect(wb.getWorksheet('Provenance')?.getCell('B7').value).toMatch(/^[a-f0-9]{64}$/);
  });
});
