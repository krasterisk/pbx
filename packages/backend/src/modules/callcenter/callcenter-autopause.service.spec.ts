import { CallCenterAutoPauseService } from './callcenter-autopause.service';
import { CallCenterStateService } from './callcenter-state.service';

/**
 * Unit tests for CallCenterAutoPauseService — RONA + the three configurable
 * rule types (missed_count/idle_time/status_duration), all sourced from
 * cc_settings.autopause_rules JSON (D-15/Pitfall 7).
 */
describe('CallCenterAutoPauseService', () => {
  let state: CallCenterStateService;
  let service: CallCenterAutoPauseService;
  let amiService: { queuePause: jest.Mock };
  let metricsService: { recordAgentStatus: jest.Mock };
  let settingsModel: { findOne: jest.Mock };

  const setRules = (rules: any[]) => {
    settingsModel.findOne.mockResolvedValue({ autopause_rules: rules });
  };

  beforeEach(() => {
    state = new CallCenterStateService();
    amiService = { queuePause: jest.fn().mockResolvedValue(undefined) };
    metricsService = { recordAgentStatus: jest.fn() };
    settingsModel = { findOne: jest.fn().mockResolvedValue({ autopause_rules: [] }) };

    service = new CallCenterAutoPauseService(
      amiService as any,
      state,
      metricsService as unknown as any,
      settingsModel as any,
    );
  });

  // ─── RONA ───────────────────────────────────────────────

  describe('evaluateRonaOnAbandon', () => {
    it('pauses agents still RINGING in the abandoned queue (D-15)', async () => {
      state.setAgent(7, 'PJSIP/101', { status: 'RINGING', queues: ['sales_7'], userId: 42 });

      await service.evaluateRonaOnAbandon(7, 'sales_7');

      expect(amiService.queuePause).toHaveBeenCalledWith('sales_7', 'PJSIP/101', true, expect.any(String));
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('PAUSED');
      expect(metricsService.recordAgentStatus).toHaveBeenCalledWith(7, 'PJSIP/101', 'PAUSED');
    });

    it('does not pause agents in a different queue or not RINGING', async () => {
      state.setAgent(7, 'PJSIP/101', { status: 'READY', queues: ['sales_7'], userId: 42 });
      state.setAgent(7, 'PJSIP/102', { status: 'RINGING', queues: ['support_7'], userId: 43 });

      await service.evaluateRonaOnAbandon(7, 'sales_7');

      expect(amiService.queuePause).not.toHaveBeenCalled();
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('READY');
      expect(state.getAgent(7, 'PJSIP/102')?.status).toBe('RINGING');
    });

    it('does not pause a RINGING agent in the same queue for a different tenant', async () => {
      state.setAgent(9, 'PJSIP/201', { status: 'RINGING', queues: ['sales_7'], userId: 44 });

      await service.evaluateRonaOnAbandon(7, 'sales_7');

      expect(amiService.queuePause).not.toHaveBeenCalled();
    });
  });

  // ─── missed_count ───────────────────────────────────────

  describe('evaluateOnMissed (missed_count rule)', () => {
    it('does not pause below the configured threshold', async () => {
      setRules([{ type: 'missed_count', threshold: 3, pauseReasonId: 1 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'READY', queues: ['sales_7'], userId: 42 });

      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);
      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);

      expect(amiService.queuePause).not.toHaveBeenCalled();
    });

    it('pauses once the consecutive-miss count reaches the threshold', async () => {
      setRules([{ type: 'missed_count', threshold: 3, pauseReasonId: 1 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'READY', queues: ['sales_7'], userId: 42 });

      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);
      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);
      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);

      expect(amiService.queuePause).toHaveBeenCalledWith('sales_7', 'PJSIP/101', true, expect.any(String));
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('PAUSED');
    });

    it('resets the streak after firing so it does not immediately re-fire', async () => {
      setRules([{ type: 'missed_count', threshold: 2, pauseReasonId: 1 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'READY', queues: ['sales_7'], userId: 42 });

      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);
      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);
      expect(amiService.queuePause).toHaveBeenCalledTimes(1);

      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);
      expect(amiService.queuePause).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when no missed_count rule is configured', async () => {
      setRules([{ type: 'idle_time', thresholdSec: 60 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'READY', queues: ['sales_7'], userId: 42 });

      for (let i = 0; i < 10; i++) {
        await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);
      }

      expect(amiService.queuePause).not.toHaveBeenCalled();
    });
  });

  // ─── idle_time ──────────────────────────────────────────

  describe('evaluateOnStatusEvent (idle_time rule)', () => {
    it('pauses a READY agent idle longer than the threshold', async () => {
      setRules([{ type: 'idle_time', thresholdSec: 60, pauseReasonId: 2 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'READY', queues: ['sales_7'], userId: 42 });
      const lastCallTime = new Date(Date.now() - 90_000);

      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'READY', ['sales_7'], lastCallTime);

      expect(amiService.queuePause).toHaveBeenCalledWith('sales_7', 'PJSIP/101', true, expect.any(String));
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('PAUSED');
    });

    it('does not pause when idle time is below the threshold', async () => {
      setRules([{ type: 'idle_time', thresholdSec: 60, pauseReasonId: 2 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'READY', queues: ['sales_7'], userId: 42 });
      const lastCallTime = new Date(Date.now() - 10_000);

      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'READY', ['sales_7'], lastCallTime);

      expect(amiService.queuePause).not.toHaveBeenCalled();
    });

    it('is a no-op for non-READY statuses even if idle_time is configured', async () => {
      setRules([{ type: 'idle_time', thresholdSec: 60 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'IN_CALL', queues: ['sales_7'], userId: 42 });
      const lastCallTime = new Date(Date.now() - 90_000);

      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'IN_CALL', ['sales_7'], lastCallTime);

      expect(amiService.queuePause).not.toHaveBeenCalled();
    });
  });

  // ─── status_duration ────────────────────────────────────

  describe('evaluateOnStatusEvent (status_duration rule)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('pauses once the agent has held the watched status past the threshold', async () => {
      setRules([{ type: 'status_duration', status: 'WRAPUP', thresholdSec: 30, pauseReasonId: 3 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'WRAPUP', queues: ['sales_7'], userId: 42 });

      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'WRAPUP', ['sales_7']);
      expect(amiService.queuePause).not.toHaveBeenCalled();

      jest.advanceTimersByTime(35_000);
      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'WRAPUP', ['sales_7']);

      expect(amiService.queuePause).toHaveBeenCalledWith('sales_7', 'PJSIP/101', true, expect.any(String));
    });

    it('does not pause when the status duration is below the threshold', async () => {
      setRules([{ type: 'status_duration', status: 'WRAPUP', thresholdSec: 30, pauseReasonId: 3 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'WRAPUP', queues: ['sales_7'], userId: 42 });

      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'WRAPUP', ['sales_7']);
      jest.advanceTimersByTime(5_000);
      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'WRAPUP', ['sales_7']);

      expect(amiService.queuePause).not.toHaveBeenCalled();
    });

    it('resets the status timer when the agent transitions to a different status', async () => {
      setRules([{ type: 'status_duration', status: 'WRAPUP', thresholdSec: 30, pauseReasonId: 3 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'WRAPUP', queues: ['sales_7'], userId: 42 });

      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'WRAPUP', ['sales_7']);
      jest.advanceTimersByTime(35_000);
      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'READY', ['sales_7']);
      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'WRAPUP', ['sales_7']);

      expect(amiService.queuePause).not.toHaveBeenCalled();
    });
  });

  // ─── cross-rule interaction ─────────────────────────────

  describe('missed-count reset on IN_CALL', () => {
    it('resets the missed streak once the agent takes a call', async () => {
      setRules([{ type: 'missed_count', threshold: 2, pauseReasonId: 1 }]);
      state.setAgent(7, 'PJSIP/101', { status: 'READY', queues: ['sales_7'], userId: 42 });

      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);
      await service.evaluateOnStatusEvent(7, 'PJSIP/101', 'IN_CALL', ['sales_7']);
      await service.evaluateOnMissed(7, 'PJSIP/101', ['sales_7']);

      expect(amiService.queuePause).not.toHaveBeenCalled();
    });
  });
});
