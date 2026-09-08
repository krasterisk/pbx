import { describe, it, expect } from 'vitest';
import { buildCsv, detectCsvDelimiter, parseCsv, stripBom } from './csv';

describe('shared/lib/csv', () => {
  it('detects the delimiter from the header line only', () => {
    expect(detectCsvDelimiter('a;b;c\n1,2,3')).toBe(';');
    expect(detectCsvDelimiter('a,b,c\n1;2;3')).toBe(',');
    expect(detectCsvDelimiter('"a;b",c\n')).toBe(',');
  });

  it('strips a UTF-8 BOM before parsing', () => {
    expect(stripBom('\ufeffphone')).toBe('phone');
    expect(parseCsv('\ufeffphone;name\n555;Alice\n').header).toEqual(['phone', 'name']);
  });

  it('keeps leading zeros, a leading plus and date-like values as text', () => {
    const parsed = parseCsv('phone;name;born\n0712345;+79001234567;2024-01-15\n');
    expect(parsed.rows).toEqual([['0712345', '+79001234567', '2024-01-15']]);
  });

  it('reads quoted delimiters, escaped quotes and embedded newlines', () => {
    const parsed = parseCsv('a;b\n"x;y";"he said ""hi""\nnext"\n');
    expect(parsed.rows).toEqual([['x;y', 'he said "hi"\nnext']]);
  });

  it('reports the physical file line of every data row', () => {
    const parsed = parseCsv('a;b\n1;"multi\nline"\n2;plain\n');
    expect(parsed.lines).toEqual([2, 4]);
  });

  it('drops blank lines but keeps rows with only some empty cells', () => {
    const parsed = parseCsv('a;b\n1;\n\n;\n2;3\n');
    expect(parsed.rows).toEqual([['1', ''], ['2', '3']]);
  });

  it('writes a BOM, CRLF rows and a semicolon delimiter', () => {
    const csv = buildCsv([['a', 'b'], ['x;y', 'plain']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('a;b\r\n"x;y";plain\r\n');
  });

  it('survives a build then parse round trip', () => {
    const rows = [['phone', 'note'], ['0712345', 'line one\nline "two"; end']];
    const parsed = parseCsv(buildCsv(rows));
    expect([parsed.header, ...parsed.rows]).toEqual(rows);
  });
});
