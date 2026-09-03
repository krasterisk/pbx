import { CallbackRequestsService } from './callback-requests.service';
import { emitQueueCallbackDialplan } from '../queues/queue-dialplan.util';
import { decodeCurlPostData, extractCurlInvocation } from '../../shared/utils/dialplan-curl.util';

const windowCopy = {
  window_start: '10:00',
  window_end: '18:00',
  max_attempts: 4,
  pause_minutes: 20,
};

describe('emitQueueCallbackDialplan (D-38 D-49)', () => {
  const base = {
    queueName: 'q700_42',
    queueUid: 7,
    vpbxUserUid: 42,
    hasCallbackStep: true,
    ...windowCopy,
  };

  it('subscriber emits WaitExten/Read DTMF hook with queue_dtmf CURL and no abandon hook', () => {
    const { waitLines, extraContexts, queueContext } = emitQueueCallbackDialplan({
      ...base,
      policy: { order_mode: 'subscriber', dtmf_digit: '1' },
    });
    const text = [...waitLines, extraContexts].join('\n');
    expect(text).toMatch(/WaitExten|Read\(/);
    expect(text).toContain('internal/callback-requests/enqueue');
    expect(text).toContain('queue_dtmf');
    expect(text).not.toContain('queue_abandon');
    expect(text).not.toMatch(/QUEUESTATUS|EXITWITHTIMEOUT|hangup_handler/);
    expect(queueContext).toBeTruthy();
    const payload = decodeCurlPostData(extractCurlInvocation(text));
    expect(payload.source).toBe('queue_dtmf');
    expect(payload.queue_uid).toBe('7');
    expect(payload.window_start).toBe('10:00');
    expect(payload.max_attempts).toBe('4');
  });

  it('queue_abandon emits abandon enqueue and suppresses DTMF even if dtmf_digit is set', () => {
    const { waitLines, extraContexts, queueContext } = emitQueueCallbackDialplan({
      ...base,
      policy: { order_mode: 'queue_abandon', dtmf_digit: '9' },
    });
    const text = [...waitLines, extraContexts].join('\n');
    expect(text).not.toMatch(/WaitExten|Read\(/);
    expect(text).not.toContain('exten => 9');
    expect(text).toContain('queue_abandon');
    expect(text).toMatch(/QUEUESTATUS|EXITWITHTIMEOUT|hangup_handler/);
    expect(text).not.toContain('queue_dtmf');
    expect(queueContext).toBeNull();
    const payload = decodeCurlPostData(extractCurlInvocation(text));
    expect(payload.source).toBe('queue_abandon');
    expect(payload.queue_uid).toBe('7');
  });

  it('both emits DTMF and abandon hooks', () => {
    const { waitLines, extraContexts } = emitQueueCallbackDialplan({
      ...base,
      policy: { order_mode: 'both', dtmf_digit: '1' },
    });
    const text = [...waitLines, extraContexts].join('\n');
    expect(text).toMatch(/WaitExten|Read\(/);
    expect(text).toContain('queue_dtmf');
    expect(text).toContain('queue_abandon');
    expect(text).toMatch(/QUEUESTATUS|EXITWITHTIMEOUT|hangup_handler/);
  });

  it('emits nothing without a reachable callback step or policy', () => {
    expect(emitQueueCallbackDialplan({
      ...base,
      policy: { order_mode: 'both', dtmf_digit: '1' },
      hasCallbackStep: false,
    }).waitLines).toEqual([]);
    expect(emitQueueCallbackDialplan({
      ...base,
      policy: null,
    }).extraContexts).toBe('');
  });
});

describe('CallbackRequestsService enqueue from queue triggers', () => {
  let requests: { findOne: jest.Mock; create: jest.Mock };
  let service: CallbackRequestsService;

  beforeEach(() => {
    requests = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((row) => Promise.resolve(row)),
    };
    service = new CallbackRequestsService(requests as any);
  });

  it.each(['queue_dtmf', 'queue_abandon'] as const)(
    'stores queue_uid and window copy for %s',
    async (source) => {
      await service.enqueue({
        caller: '79001112233',
        vpbx_user_uid: 42,
        queue_uid: 7,
        source,
        window_start: '10:00',
        window_end: '18:00',
        max_attempts: 4,
        pause_minutes: 20,
      });
      expect(requests.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_uid: 42,
          caller: '79001112233',
          queue_uid: 7,
          source,
          window_start: '10:00',
          window_end: '18:00',
          max_attempts: 4,
          pause_minutes: 20,
          status: 'pending',
        }),
      );
    },
  );
});
