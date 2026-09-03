import { DEFAULT_CALLBACK_POLICY } from '@krasterisk/shared';
import {
  CallbackScannerService,
  isWithinCallbackWindow,
} from './callback-scanner.service';

function row(overrides: Record<string, unknown> = {}) {
  const update = jest.fn().mockResolvedValue(undefined);
  return {
    uid: 1,
    user_uid: 42,
    caller: '79001112233',
    status: 'pending',
    attempt_count: 0,
    max_attempts: 3,
    pause_minutes: 15,
    window_start: '00:00',
    window_end: '23:59',
    next_attempt_at: new Date('2026-09-04T10:00:00Z'),
    update,
    ...overrides,
  };
}

describe('isWithinCallbackWindow', () => {
  it('includes now inside a daytime window and excludes outside', () => {
    const noon = new Date('2026-09-04T12:00:00');
    expect(isWithinCallbackWindow(noon, '09:00', '18:00')).toBe(true);
    expect(isWithinCallbackWindow(noon, '02:00', '03:00')).toBe(false);
  });
});

describe('CallbackScannerService', () => {
  let requests: { findAll: jest.Mock };
  let settings: { getTenantSettings: jest.Mock };
  let ami: { action: jest.Mock };
  let scanner: CallbackScannerService;

  beforeEach(() => {
    requests = { findAll: jest.fn().mockResolvedValue([]) };
    settings = {
      getTenantSettings: jest.fn().mockResolvedValue({
        callback_policy: { ...DEFAULT_CALLBACK_POLICY, dial_order: 'caller_first' },
      }),
    };
    ami = { action: jest.fn().mockResolvedValue({}) };
    scanner = new CallbackScannerService(requests as any, settings as any, ami as any);
  });

  it('mutex skips a second overlapping tick', async () => {
    let release!: (rows: unknown[]) => void;
    requests.findAll.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    const first = scanner.tick();
    const second = scanner.tick();
    release([]);
    await Promise.all([first, second]);
    expect(requests.findAll).toHaveBeenCalledTimes(1);
  });

  it('does not originate or increment attempts outside the window', async () => {
    const pending = row({ window_start: '02:00', window_end: '03:00' });
    requests.findAll.mockResolvedValue([pending]);
    await scanner.scanOnce(new Date('2026-09-04T12:00:00'));
    expect(ami.action).not.toHaveBeenCalled();
    expect(pending.update).not.toHaveBeenCalled();
  });

  it('caps attempts and marks failed when originate throws at max', async () => {
    const pending = row({ attempt_count: 2, max_attempts: 3 });
    requests.findAll.mockResolvedValue([pending]);
    ami.action.mockRejectedValue(new Error('ami down'));
    await scanner.scanOnce(new Date('2026-09-04T12:00:00'));
    expect(pending.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempt_count: 3 }),
    );
  });

  it('originates via krsk-click-to-call using tenant dial_order', async () => {
    const pending = row();
    requests.findAll.mockResolvedValue([pending]);
    await scanner.scanOnce(new Date('2026-09-04T12:00:00'));
    expect(ami.action).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'Originate',
        context: 'krsk-click-to-call',
        exten: '79001112233',
        variable: 'KRSK_CB_DIAL_ORDER=caller_first',
      }),
    );
    expect(pending.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', attempt_count: 1 }),
    );
  });
});
