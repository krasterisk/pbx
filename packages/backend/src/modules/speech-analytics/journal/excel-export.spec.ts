import ExcelJS from 'exceljs';
import { UserLevel } from '../../users/user.model';
import { isJournalRowVisible, type JournalRowAccessFields } from './journal.service';
import {
  EXCEL_CELL_CHAR_LIMIT,
  JOURNAL_EXCEL_BASE_KEYS,
  ROBOT_COLUMN_KEYS,
  buildJournalExcel,
  filterExportRowsByAccess,
  truncateCell,
  type JournalExcelRow,
} from './excel-export';

describe('truncateCell (D-37 / aiPBX parity)', () => {
  it('leaves short cells unchanged', () => {
    expect(truncateCell('hello')).toBe('hello');
  });

  it('truncates transcripts longer than the Excel cell limit', () => {
    const long = 'x'.repeat(EXCEL_CELL_CHAR_LIMIT + 500);
    const out = truncateCell(long);
    expect(out.length).toBe(EXCEL_CELL_CHAR_LIMIT);
    expect(out).toBe(long.slice(0, EXCEL_CELL_CHAR_LIMIT));
  });
});

describe('journal Excel column contract (D-37)', () => {
  const scaleKeys = ['greeting_present', 'next_step_agreed'];

  const row: JournalExcelRow = {
    id: 'rec-1',
    occurredAt: '2026-09-21T10:00:00.000Z',
    sourceKind: 'pbx',
    latestAmount: '12.50',
    currency: 'RUB',
    summary: 'Greeting ok',
    transcript: 'y'.repeat(EXCEL_CELL_CHAR_LIMIT + 100),
    sttQuality: 'ok',
    topics: 'support',
    rationales: 'bounded v1 rubric',
    scales: {
      greeting_present: 'true',
      next_step_agreed: 'false',
    },
  };

  it('exports base journal columns then summary, transcript, STT quality, topics, rationales, then project scales', async () => {
    const buffer = await buildJournalExcel([row], scaleKeys);
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const headers = (sheet.getRow(1).values as Array<string | null | undefined>).slice(1);

    expect(headers.slice(0, JOURNAL_EXCEL_BASE_KEYS.length)).toEqual([
      'id',
      'occurredAt',
      'sourceKind',
      'latestAmount',
      'currency',
      'summary',
      'transcript',
      'sttQuality',
      'topics',
      'rationales',
    ]);
    expect(headers.slice(JOURNAL_EXCEL_BASE_KEYS.length)).toEqual(scaleKeys);
  });

  it('never includes robot KPI columns', async () => {
    const buffer = await buildJournalExcel([row], scaleKeys);
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const headers = (sheet.getRow(1).values as Array<string | null | undefined>).slice(1);
    for (const forbidden of ROBOT_COLUMN_KEYS) {
      expect(headers).not.toContain(forbidden);
    }
  });

  it('applies truncateCell to the transcript cell in the workbook', async () => {
    const buffer = await buildJournalExcel([row], scaleKeys);
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    const transcriptIdx = JOURNAL_EXCEL_BASE_KEYS.indexOf('transcript') + 1;
    const cellValue = String(sheet.getRow(2).getCell(transcriptIdx).value ?? '');
    expect(cellValue.length).toBe(EXCEL_CELL_CHAR_LIMIT);
  });
});

describe('export access scope (T-18-11-IDOR)', () => {
  it('keeps only rows visible under the same CDR access scope as the journal list', () => {
    const scoped = { operators: ['101'], queues: [], ownExten: '200' };
    const viewer = { userId: 9, level: UserLevel.SUPERVISOR };
    const rows: Array<JournalExcelRow & JournalRowAccessFields> = [
      {
        id: 'visible',
        occurredAt: '2026-09-21T10:00:00.000Z',
        sourceKind: 'pbx',
        latestAmount: null,
        currency: null,
        summary: null,
        transcript: null,
        sttQuality: null,
        topics: null,
        rationales: null,
        scales: {},
        operatorExten: '101',
        operatorName: null,
        uploadedByUserId: null,
      },
      {
        id: 'hidden',
        occurredAt: '2026-09-21T11:00:00.000Z',
        sourceKind: 'pbx',
        latestAmount: null,
        currency: null,
        summary: null,
        transcript: null,
        sttQuality: null,
        topics: null,
        rationales: null,
        scales: {},
        operatorExten: '300',
        operatorName: null,
        uploadedByUserId: null,
      },
    ];

    const filtered = filterExportRowsByAccess(rows, scoped, viewer);
    expect(filtered.map((r) => r.id)).toEqual(['visible']);
    expect(
      isJournalRowVisible(
        {
          id: 'hidden',
          operatorExten: '300',
          operatorName: null,
          uploadedByUserId: null,
          sourceKind: 'pbx',
        },
        scoped,
        viewer,
      ),
    ).toBe(false);
  });
});
