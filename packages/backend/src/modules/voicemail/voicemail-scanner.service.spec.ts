import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Op } from 'sequelize';
import { VoicemailScannerService } from './voicemail-scanner.service';

function buildWav(opts: {
  sampleRate?: number;
  channels?: number;
  pcm?: Buffer;
  extraChunksBeforeData?: { id: string; body: Buffer }[];
}): Buffer {
  const sampleRate = opts.sampleRate ?? 8000;
  const channels = opts.channels ?? 1;
  const bits = 16;
  const pcm = opts.pcm ?? Buffer.from([0x00, 0x00, 0x01, 0x00]);
  const fmtBody = Buffer.alloc(16);
  fmtBody.writeUInt16LE(1, 0);
  fmtBody.writeUInt16LE(channels, 2);
  fmtBody.writeUInt32LE(sampleRate, 4);
  fmtBody.writeUInt32LE(sampleRate * channels * (bits / 8), 8);
  fmtBody.writeUInt16LE(channels * (bits / 8), 12);
  fmtBody.writeUInt16LE(bits, 14);

  const chunks: Buffer[] = [];
  const pushChunk = (id: string, body: Buffer) => {
    const hdr = Buffer.alloc(8);
    hdr.write(id.padEnd(4, ' ').slice(0, 4), 0, 4, 'ascii');
    hdr.writeUInt32LE(body.length, 4);
    const pad = body.length % 2 ? Buffer.from([0]) : Buffer.alloc(0);
    chunks.push(hdr, body, pad);
  };
  pushChunk('fmt ', fmtBody);
  for (const extra of opts.extraChunksBeforeData ?? []) {
    pushChunk(extra.id, extra.body);
  }
  const dataHdr = Buffer.alloc(8);
  dataHdr.write('data', 0, 4, 'ascii');
  dataHdr.writeUInt32LE(pcm.length, 4);
  chunks.push(dataHdr, pcm);

  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 4, 'ascii');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WAVE', 8, 4, 'ascii');
  return Buffer.concat([header, body]);
}

function makeRow(overrides: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    uid: 1,
    uniqueid: '1693731234.99',
    file_rel: '42/voicemail/1693731234.99.wav',
    user_uid: 42,
    notify_status: 'pending',
    transcript_status: 'ready',
    notify_attempts: 0,
    transcript_attempts: 0,
    next_notify_at: new Date(Date.now() - 1_000),
    scan_locked_until: null,
    notify_error: null,
    update: jest.fn().mockImplementation((patch: Record<string, unknown>) => {
      Object.assign(row, patch);
      return Promise.resolve(row);
    }),
    ...overrides,
  };
  return row;
}

describe('VoicemailScannerService notify axis (D-61 / D-68 / D-69)', () => {
  let messages: { findAll: jest.Mock };
  let voicemail: { retryNotify: jest.Mock };
  let scanner: VoicemailScannerService;

  beforeEach(() => {
    messages = { findAll: jest.fn().mockResolvedValue([]) };
    voicemail = { retryNotify: jest.fn().mockResolvedValue(undefined) };
    scanner = new VoicemailScannerService(messages as any, voicemail as any);
  });

  it('tick is a no-op when a scan is already running', async () => {
    let release!: () => void;
    messages.findAll.mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = scanner.tick();
    await Promise.resolve();
    await Promise.resolve();

    await scanner.tick();
    expect(messages.findAll).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  it('scanOnce selects pending notify rows due now with a lease, LIMIT 20', async () => {
    await scanner.scanOnce();

    expect(messages.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
        where: expect.objectContaining({
          notify_status: 'pending',
          next_notify_at: expect.objectContaining({ [Op.lte]: expect.any(Date) }),
        }),
      }),
    );
  });

  it('three notify failures mark notify_status=failed, keep the row, set notify_error', async () => {
    const row = makeRow();
    messages.findAll.mockImplementation((args: { where?: { notify_status?: string } }) => {
      if (args?.where?.notify_status === 'pending' && row.notify_status === 'pending') {
        return Promise.resolve([row]);
      }
      return Promise.resolve([]);
    });
    voicemail.retryNotify.mockRejectedValue(new Error('smtp down'));

    const before1 = Date.now();
    await scanner.scanOnce();
    expect(row.notify_status).toBe('pending');
    expect(row.notify_attempts).toBe(1);
    expect(row.notify_error).toMatch(/smtp down/);
    expect((row.next_notify_at as Date).getTime()).toBeGreaterThanOrEqual(before1 + 60_000 - 50);

    const before2 = Date.now();
    await scanner.scanOnce();
    expect(row.notify_status).toBe('pending');
    expect(row.notify_attempts).toBe(2);
    expect((row.next_notify_at as Date).getTime()).toBeGreaterThanOrEqual(before2 + 4 * 60_000 - 50);

    await scanner.scanOnce();
    expect(row.notify_status).toBe('failed');
    expect(row.notify_attempts).toBe(3);
    expect(row.notify_error).toMatch(/smtp down/);
    expect(row.file_rel).toBe('42/voicemail/1693731234.99.wav');
    expect(voicemail.retryNotify).toHaveBeenCalledTimes(3);
  });

  it('stores notify_error on the row and never calls an admin alerter', async () => {
    const row = makeRow({ notify_attempts: 2 });
    messages.findAll.mockResolvedValue([row]);
    voicemail.retryNotify.mockRejectedValue(new Error('timeout'));

    await scanner.scanOnce();

    expect(row.notify_error).toBe('timeout');
    expect(row.notify_status).toBe('failed');
    expect((scanner as any).alerter).toBeUndefined();
    expect((scanner as any).adminAlert).toBeUndefined();
  });
});

describe('VoicemailScannerService transcript axis (D-60 / D-63 / D-70 / D-71)', () => {
  const uniqueid = '1693731234.50';
  const fileRel = `42/voicemail/${uniqueid}.wav`;
  let base: string;
  let messages: { findAll: jest.Mock; findOne: jest.Mock };
  let sttEngines: { findAll: jest.Mock; findOne: jest.Mock };
  let sttFactory: { transcribe: jest.Mock; createStream: jest.Mock };
  let llm: { summarize: jest.Mock };
  let aiProviders: { findAll: jest.Mock };
  let systemSettings: { getServerConfigRaw: jest.Mock };
  let scanner: VoicemailScannerService;
  let row: ReturnType<typeof makeRow>;

  function writeWav(buf: Buffer) {
    const dest = path.join(base, '42', 'voicemail');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, `${uniqueid}.wav`), buf);
  }

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-scan-stt-'));
    row = makeRow({
      uniqueid,
      file_rel: fileRel,
      notify_status: 'sent',
      transcript_status: 'pending',
      next_notify_at: null,
    });
    messages = {
      findAll: jest.fn().mockImplementation((args: { where?: { transcript_status?: string } }) => {
        if (args?.where?.transcript_status === 'pending' && row.transcript_status === 'pending') {
          return Promise.resolve([row]);
        }
        return Promise.resolve([]);
      }),
      findOne: jest.fn().mockResolvedValue(row),
    };
    sttEngines = { findAll: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
    sttFactory = { transcribe: jest.fn(), createStream: jest.fn() };
    llm = { summarize: jest.fn() };
    aiProviders = { findAll: jest.fn().mockResolvedValue([]) };
    systemSettings = {
      getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: base }),
    };
    scanner = new VoicemailScannerService(
      messages as any,
      { retryNotify: jest.fn() } as any,
      sttEngines as any,
      sttFactory as any,
      llm as any,
      aiProviders as any,
      systemSettings as any,
    );
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('marks not_configured immediately when the tenant has no STT engine', async () => {
    await scanner.scanOnce();

    expect(row.transcript_status).toBe('not_configured');
    expect(row.transcript_attempts).toBe(0);
    expect(row.notify_status).toBe('sent');
    expect(sttFactory.transcribe).not.toHaveBeenCalled();
    expect(sttFactory.createStream).not.toHaveBeenCalled();
  });

  it('three STT throws set transcript_status=failed and leave notify_status unchanged', async () => {
    sttEngines.findAll.mockResolvedValue([{ uid: 9, type: 'custom', user_uid: 42 }]);
    sttFactory.transcribe.mockRejectedValue(new Error('stt down'));
    writeWav(buildWav({}));

    await scanner.scanOnce();
    expect(row.transcript_status).toBe('pending');
    expect(row.transcript_attempts).toBe(1);
    expect(row.notify_status).toBe('sent');

    await scanner.scanOnce();
    expect(row.transcript_attempts).toBe(2);
    expect(row.notify_status).toBe('sent');

    await scanner.scanOnce();
    expect(row.transcript_status).toBe('failed');
    expect(row.transcript_attempts).toBe(3);
    expect(row.notify_status).toBe('sent');
    expect(sttFactory.createStream).not.toHaveBeenCalled();
  });

  it('transcribes LIST-chunk wav via parseWavPcm16 and stores the transcript', async () => {
    const pcm = Buffer.from([0x11, 0x22, 0x33, 0x44]);
    writeWav(buildWav({
      pcm,
      extraChunksBeforeData: [{ id: 'LIST', body: Buffer.alloc(24, 0x7f) }],
    }));
    sttEngines.findAll.mockResolvedValue([{ uid: 9, type: 'custom', user_uid: 42 }]);
    sttFactory.transcribe.mockResolvedValue({ text: ' перезвоните ' });

    await scanner.scanOnce();

    expect(sttFactory.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 9 }),
      pcm,
      'ru-RU',
    );
    expect(row.transcript).toBe('перезвоните');
    expect(row.transcript_status).toBe('ready');
    expect(row.notify_status).toBe('sent');
    expect(sttFactory.createStream).not.toHaveBeenCalled();
  });

  it('retryTranscript resets attempts and sets pending without touching notify', async () => {
    row.transcript_status = 'failed';
    row.transcript_attempts = 3;
    await scanner.retryTranscript(uniqueid);
    expect(row.transcript_status).toBe('pending');
    expect(row.transcript_attempts).toBe(0);
    expect(row.notify_status).toBe('sent');
  });

  it('uses stt_engine_uid from notify_dispatch before tenant default (D-63)', async () => {
    row.notify_dispatch = JSON.stringify({ stt_engine_uid: 3 });
    sttEngines.findOne.mockResolvedValue({ uid: 3, type: 'custom', user_uid: 42 });
    sttEngines.findAll.mockResolvedValue([{ uid: 9, type: 'custom', user_uid: 42 }]);
    writeWav(buildWav({}));
    sttFactory.transcribe.mockResolvedValue({ text: 'ok' });

    await scanner.scanOnce();

    expect(sttEngines.findOne).toHaveBeenCalledWith(3, 42);
    expect(sttFactory.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 3 }),
      expect.any(Buffer),
      'ru-RU',
    );
  });
});
