import { Op } from 'sequelize';
import { VoicemailScannerService } from './voicemail-scanner.service';

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
