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
