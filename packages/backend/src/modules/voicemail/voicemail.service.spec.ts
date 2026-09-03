import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { VoicemailService, safeVoicemailFilePath } from './voicemail.service';

describe('safeVoicemailFilePath', () => {
  let base: string;

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-safe-'));
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('rejects a relative path that contains ..', () => {
    expect(safeVoicemailFilePath(base, '../secret.wav')).toBeNull();
    expect(safeVoicemailFilePath(base, '1/voicemail/../../../etc/passwd')).toBeNull();
  });

  it('does not append .mp3 and resolves the DB .wav path', () => {
    const rel = '7/voicemail/1693731234.12.wav';
    const dest = path.join(base, '7', 'voicemail');
    fs.mkdirSync(dest, { recursive: true });
    const wav = path.join(dest, '1693731234.12.wav');
    fs.writeFileSync(wav, 'RIFF');

    const resolved = safeVoicemailFilePath(base, rel);
    expect(resolved).not.toBeNull();
    expect(resolved).toBe(path.resolve(wav));
    expect(resolved).not.toMatch(/\.mp3$/i);
    expect(resolved).not.toMatch(/\.wav\.mp3$/i);
    expect(fs.existsSync(`${resolved}.mp3`)).toBe(false);
  });

  it('returns null when the wav file is missing', () => {
    expect(safeVoicemailFilePath(base, '7/voicemail/missing.wav')).toBeNull();
  });
});

describe('VoicemailService.mintPlayToken', () => {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  let tokens: { create: jest.Mock };
  let config: { get: jest.Mock };
  let service: VoicemailService;

  beforeEach(() => {
    tokens = { create: jest.fn().mockResolvedValue({}) };
    config = { get: jest.fn().mockReturnValue('https://pbx.example.test') };
    service = new VoicemailService(
      { findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() } as any,
      tokens as any,
      config as any,
      { getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: '/usr/records' }) } as any,
    );
  });

  it('inserts a 7-day token and returns an APP_URL play link', async () => {
    const before = Date.now();
    const url = await service.mintPlayToken({ uid: 7, user_uid: 42 } as any);
    const after = Date.now();

    expect(config.get).toHaveBeenCalledWith('APP_URL');
    expect(url).toMatch(/^https:\/\/pbx\.example\.test\/api\/voicemail\/play\?token=[0-9a-f]{64}$/);

    expect(tokens.create).toHaveBeenCalledTimes(1);
    const row = tokens.create.mock.calls[0][0];
    expect(row.message_uid).toBe(7);
    expect(row.vpbx_user_uid).toBe(42);
    expect(row.revoked_at).toBeNull();
    expect(row.token).toMatch(/^[0-9a-f]{64}$/);
    expect(row.expires_at).toBeInstanceOf(Date);
    const ttl = row.expires_at.getTime() - before;
    expect(ttl).toBeGreaterThanOrEqual(SEVEN_DAYS_MS - 1000);
    expect(ttl).toBeLessThanOrEqual(SEVEN_DAYS_MS + (after - before) + 1000);
  });
});

describe('VoicemailService.ingest first notify (D-62 / D-64 / D-65 / D-66)', () => {
  const ATTACH_MAX = 2 * 1024 * 1024;
  const uniqueid = '1693731234.12';
  const fileRel = `42/voicemail/${uniqueid}.wav`;

  let base: string;
  let messages: { findOne: jest.Mock; create: jest.Mock };
  let tokens: { create: jest.Mock };
  let config: { get: jest.Mock };
  let systemSettings: { getServerConfigRaw: jest.Mock };
  let dispatcher: { dispatch: jest.Mock };
  let created: { uid: number; user_uid: number; uniqueid: string; file_rel: string; notify_attempts: number; update: jest.Mock };
  let service: VoicemailService;

  function writeWav(size: number) {
    const dest = path.join(base, '42', 'voicemail');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, `${uniqueid}.wav`), Buffer.alloc(size));
  }

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-notify-'));
    created = {
      uid: 9,
      user_uid: 42,
      uniqueid,
      file_rel: fileRel,
      notify_attempts: 0,
      update: jest.fn().mockResolvedValue(undefined),
    };
    messages = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    };
    tokens = { create: jest.fn().mockResolvedValue({}) };
    config = { get: jest.fn().mockReturnValue('https://pbx.example.test') };
    systemSettings = {
      getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: base }),
    };
    dispatcher = { dispatch: jest.fn().mockResolvedValue({ success: true }) };
    service = new VoicemailService(
      messages as any,
      tokens as any,
      config as any,
      systemSettings as any,
      dispatcher as any,
    );
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  const ingestBody = {
    uniqueid,
    file: fileRel,
    status: 'HANGUP',
    clid: '79001234567',
    exten: '100',
    vpbx_user_uid: 42,
    integration_uid: 15,
    body: 'Новое сообщение',
    target: 'ops',
  };

  it('size 2MiB-1 takes the attach path', async () => {
    writeWav(ATTACH_MAX - 1);
    await service.ingest(ingestBody);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const payload = dispatcher.dispatch.mock.calls[0][0];
    expect(payload.integration_uid).toBe(15);
    expect(payload.attach).toEqual(
      expect.objectContaining({
        filename: expect.stringMatching(/\.wav$/),
        contentType: 'audio/wav',
      }),
    );
    expect(Buffer.isBuffer(payload.attach.content)).toBe(true);
    expect(payload.attach.content.length).toBe(ATTACH_MAX - 1);
    expect(payload.message).toMatch(/RECORDED_FILE/);
    expect(tokens.create).not.toHaveBeenCalled();
    expect(created.update).toHaveBeenCalledWith(
      expect.objectContaining({ notify_status: 'sent' }),
    );
  });

  it('size 2MiB takes the link path (no attach)', async () => {
    writeWav(ATTACH_MAX);
    await service.ingest(ingestBody);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const payload = dispatcher.dispatch.mock.calls[0][0];
    expect(payload.attach).toBeUndefined();
    expect(payload.message).toMatch(/\/api\/voicemail\/play\?token=/);
    expect(payload.message).toMatch(/RECORDED_FILE/);
    expect(tokens.create).toHaveBeenCalledTimes(1);
    expect(created.update).toHaveBeenCalledWith(
      expect.objectContaining({ notify_status: 'sent' }),
    );
  });

  it('attachment_rejected resends text+link and leaves notify_attempts unchanged', async () => {
    writeWav(ATTACH_MAX - 1);
    dispatcher.dispatch
      .mockResolvedValueOnce({ success: false, error: 'attachment_rejected' })
      .mockResolvedValueOnce({ success: true });

    await service.ingest(ingestBody);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(dispatcher.dispatch.mock.calls[1][0].attach).toBeUndefined();
    expect(dispatcher.dispatch.mock.calls[1][0].message).toMatch(
      /\/api\/voicemail\/play\?token=/,
    );
    expect(tokens.create).toHaveBeenCalledTimes(1);
    const updates = created.update.mock.calls.map((c) => c[0]);
    expect(updates.some((u) => u.notify_attempts !== undefined && u.notify_attempts !== 0)).toBe(
      false,
    );
    expect(updates[updates.length - 1]).toEqual(
      expect.objectContaining({ notify_status: 'sent' }),
    );
  });

  it('transport fail sets pending + attempts=1 + next_notify_at ~ now+1min', async () => {
    writeWav(ATTACH_MAX - 1);
    dispatcher.dispatch.mockResolvedValue({ success: false, error: 'network' });
    const before = Date.now();
    await service.ingest(ingestBody);
    const after = Date.now();

    const patch = created.update.mock.calls[0][0];
    expect(patch.notify_status).toBe('pending');
    expect(patch.notify_attempts).toBe(1);
    expect(patch.notify_error).toBe('network');
    const eta = patch.next_notify_at.getTime();
    expect(eta).toBeGreaterThanOrEqual(before + 60_000 - 50);
    expect(eta).toBeLessThanOrEqual(after + 60_000 + 50);
  });

  it('does not start STT on the ingest path', async () => {
    writeWav(100);
    await service.ingest(ingestBody);
    expect((service as any).transcribe).toBeUndefined();
    expect((service as any).summarize).toBeUndefined();
  });
});

describe('VoicemailService JWT detail / play / retry-stt (D-58)', () => {
  const uniqueid = '1693731234.12';
  const fileRel = `100/voicemail/${uniqueid}.wav`;
  let base: string;
  let messages: { findOne: jest.Mock };
  let scanner: { retryTranscript: jest.Mock };
  let cdrService: { findByUniqueid: jest.Mock };
  let service: VoicemailService;
  let row: {
    uid: number;
    user_uid: number;
    uniqueid: string;
    file_rel: string;
    transcript_status: string;
    notify_status: string;
    toJSON?: () => Record<string, unknown>;
  };

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-jwt-'));
    const dest = path.join(base, '100', 'voicemail');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, `${uniqueid}.wav`), Buffer.from('RIFF....WAVEfmt '));
    row = {
      uid: 3,
      user_uid: 100,
      uniqueid,
      file_rel: fileRel,
      transcript_status: 'failed',
      notify_status: 'sent',
      toJSON() {
        return { ...this, token: undefined };
      },
    };
    messages = { findOne: jest.fn().mockResolvedValue(row) };
    scanner = { retryTranscript: jest.fn().mockResolvedValue(undefined) };
    cdrService = { findByUniqueid: jest.fn().mockResolvedValue({ uniqueid }) };
    service = new VoicemailService(
      messages as any,
      { create: jest.fn() } as any,
      { get: jest.fn() } as any,
      { getServerConfigRaw: jest.fn().mockResolvedValue({ records_base_path: base }) } as any,
      undefined,
      scanner as any,
      cdrService as any,
    );
  });

  afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
  });

  it('findByUniqueid 404s when the row belongs to another tenant', async () => {
    messages.findOne.mockResolvedValue(null);
    await expect(service.findByUniqueid(100, uniqueid, 7)).rejects.toThrow('Voicemail message not found');
    expect(messages.findOne).toHaveBeenCalledWith({ where: { user_uid: 100, uniqueid } });
  });

  it('findByUniqueid 404s when CDR access-scope hides the call', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    cdrService.findByUniqueid.mockRejectedValue(new NotFoundException('Call not found'));
    await expect(service.findByUniqueid(100, uniqueid, 7)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('detail DTO has no token or play-by-token URL field', async () => {
    const detail = await service.findByUniqueid(100, uniqueid, 7);
    expect(detail).not.toHaveProperty('token');
    expect(detail).not.toHaveProperty('token_url');
    expect(detail).not.toHaveProperty('playUrl');
    expect(detail).not.toHaveProperty('play_url');
    expect(JSON.stringify(detail)).not.toMatch(/\/voicemail\/play\?token=/);
  });

  it('play sets audio/wav, supports Range, and download=1 sets .wav disposition', async () => {
    const { PassThrough } = await import('stream');
    const headers: Record<string, string | number> = {};
    const res = Object.assign(new PassThrough(), {
      setHeader: jest.fn((k: string, v: string | number) => {
        headers[k] = v;
      }),
      status: jest.fn().mockReturnThis(),
      headersSent: false,
    });
    const req = {
      query: { download: '1' },
      headers: { range: 'bytes=0-3' },
      user: { vpbx_user_uid: 100, sub: 7 },
    };

    await service.streamByUniqueid(100, uniqueid, res as any, req as any, 7);

    expect(headers['Content-Type']).toBe('audio/wav');
    expect(String(headers['Content-Disposition'])).toMatch(/attachment; filename="[^"]+\.wav"/);
    expect(res.status).toHaveBeenCalledWith(206);
  });

  it('retryStt calls scanner.retryTranscript only when transcript_status is failed', async () => {
    await service.retryStt(100, uniqueid, 7);
    expect(scanner.retryTranscript).toHaveBeenCalledWith(uniqueid);
  });

  it('retryStt rejects not_configured and does not retry', async () => {
    row.transcript_status = 'not_configured';
    await expect(service.retryStt(100, uniqueid, 7)).rejects.toThrow();
    expect(scanner.retryTranscript).not.toHaveBeenCalled();
  });
});
