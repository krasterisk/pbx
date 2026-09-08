export const CSV_DELIMITERS = [';', ','] as const;

export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

export interface ParsedCsv {
  delimiter: CsvDelimiter;
  header: string[];
  /** Data rows without the header. Every cell stays raw text. */
  rows: string[][];
  /** Physical 1-based file line of each data row. */
  lines: number[];
}

/**
 * Reads a file as text. Excel RU often writes windows-1251, so UTF-8 is tried
 * in strict mode first and the legacy encoding is only used as a fallback.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read error'));
    reader.onload = () => {
      const buffer = reader.result as ArrayBuffer;
      let text: string;
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder('windows-1251').decode(buffer);
      }
      resolve(stripBom(text));
    };
    reader.readAsArrayBuffer(file);
  });
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function detectCsvDelimiter(text: string): CsvDelimiter {
  let inQuotes = false;
  let semicolons = 0;
  let commas = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === '\n' || ch === '\r') break;
    if (ch === ';') semicolons += 1;
    if (ch === ',') commas += 1;
  }
  return commas > semicolons ? ',' : ';';
}

/**
 * RFC 4180 reader that keeps every cell as raw text, so leading zeros,
 * a leading plus and date-like strings are never reinterpreted.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = stripBom(input);
  const delimiter = detectCsvDelimiter(text);
  const all: Array<{ cells: string[]; line: number }> = [];
  let cells: string[] = [];
  let cell = '';
  let line = 1;
  let rowLine = 1;
  let inQuotes = false;

  const endRow = (): void => {
    cells.push(cell);
    all.push({ cells, line: rowLine });
    cells = [];
    cell = '';
    line += 1;
    rowLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      if (ch === '\n') line += 1;
      cell += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      cells.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      endRow();
      continue;
    }
    if (ch === '\n') {
      endRow();
      continue;
    }
    cell += ch;
  }

  if (cell !== '' || cells.length > 0) {
    cells.push(cell);
    all.push({ cells, line: rowLine });
  }

  if (!all.length) return { delimiter, header: [], rows: [], lines: [] };

  const body = all.slice(1).filter((row) => row.cells.some((value) => value.trim() !== ''));
  return {
    delimiter,
    header: all[0].cells.map((value) => value.trim()),
    rows: body.map((row) => row.cells),
    lines: body.map((row) => row.line),
  };
}

export function escapeCsvCell(value: string): string {
  return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** UTF-8 BOM plus a semicolon delimiter keeps Excel RU from mangling the file. */
export function buildCsv(rows: string[][]): string {
  const body = rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
  return `\ufeff${body}\r\n`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(csv: string, filename: string): void {
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}
