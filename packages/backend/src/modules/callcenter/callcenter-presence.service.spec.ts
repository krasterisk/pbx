import { CallCenterPresenceService, PRESENCE_DEBOUNCE_MS } from './callcenter-presence.service';
import { CallCenterStateService } from './callcenter-state.service';

/**
 * Unit tests for CallCenterPresenceService (D-36/D-37/D-45).
 * DeviceState/ExtensionState → debounced presenceUpdate SSE deltas.
 */
describe('CallCenterPresenceService', () => {
  let state: CallCenterStateService;
  let service: CallCenterPresenceService;

  beforeEach(() => {
    jest.useFakeTimers();
    state = new CallCenterStateService();
    service = new CallCenterPresenceService(state);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('handleDeviceStateChange', () => {
    it('emits a presenceUpdate delta for the tenant parsed from the device suffix', () => {
      const received: any[] = [];
      state.getEventStream(0).subscribe(e => received.push(e));

      service.handleDeviceStateChange({ device: 'PJSIP/e110_0', state: 'INUSE' });
      jest.advanceTimersByTime(PRESENCE_DEBOUNCE_MS);

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('presenceUpdate');
      expect(received[0].data).toEqual(
        expect.objectContaining({ device: 'PJSIP/e110_0', extension: '110', state: 'INUSE' }),
      );
    });

    it('coalesces rapid bursts for the same device into a single delta with the final state', () => {
      const received: any[] = [];
      state.getEventStream(0).subscribe(e => received.push(e));

      service.handleDeviceStateChange({ device: 'PJSIP/e110_0', state: 'RINGING' });
      jest.advanceTimersByTime(50);
      service.handleDeviceStateChange({ device: 'PJSIP/e110_0', state: 'INUSE' });
      jest.advanceTimersByTime(50);
      service.handleDeviceStateChange({ device: 'PJSIP/e110_0', state: 'NOT_INUSE' });
      jest.advanceTimersByTime(PRESENCE_DEBOUNCE_MS);

      expect(received).toHaveLength(1);
      expect(received[0].data.state).toBe('NOT_INUSE');
    });

    it('does not coalesce across two different devices', () => {
      const received: any[] = [];
      state.getEventStream(0).subscribe(e => received.push(e));

      service.handleDeviceStateChange({ device: 'PJSIP/e110_0', state: 'INUSE' });
      service.handleDeviceStateChange({ device: 'PJSIP/e111_0', state: 'RINGING' });
      jest.advanceTimersByTime(PRESENCE_DEBOUNCE_MS);

      expect(received).toHaveLength(2);
    });

    it('ignores a device string with no tenant suffix', () => {
      const received: any[] = [];
      state.getEventStream(0).subscribe(e => received.push(e));

      service.handleDeviceStateChange({ device: 'PJSIP/notenant', state: 'INUSE' });
      jest.advanceTimersByTime(PRESENCE_DEBOUNCE_MS);

      expect(received).toHaveLength(0);
    });

    it('is a no-op for an empty device string', () => {
      expect(() => service.handleDeviceStateChange({})).not.toThrow();
    });

    it('updates getPresence immediately; SSE emit waits for debounce', () => {
      const received: any[] = [];
      state.getEventStream(0).subscribe(e => received.push(e));

      service.handleDeviceStateChange({ device: 'PJSIP/e110_0', state: 'INUSE' });
      expect(service.getPresence(0, '110')).toBe('INUSE');
      expect(received).toHaveLength(0);

      jest.advanceTimersByTime(PRESENCE_DEBOUNCE_MS);
      expect(received).toHaveLength(1);
      expect(received[0].data.state).toBe('INUSE');
    });

    it('accepts PascalCase Device/State from AMI', () => {
      service.handleDeviceStateChange({ Device: 'PJSIP/e110_0', State: 'NOT_INUSE' });
      expect(service.getPresence(0, '110')).toBe('NOT_INUSE');
    });
  });

  describe('handleExtensionStatus', () => {
    it('emits a presenceUpdate delta keyed by extension, tenant from context suffix', () => {
      const received: any[] = [];
      state.getEventStream(7).subscribe(e => received.push(e));

      service.handleExtensionStatus({ exten: '205', context: 'from-internal_7', status: '1' });
      jest.advanceTimersByTime(PRESENCE_DEBOUNCE_MS);

      expect(received).toHaveLength(1);
      expect(received[0].userUid).toBe(7);
      expect(received[0].data).toEqual(
        expect.objectContaining({ extension: '205', state: '1' }),
      );
    });

    it('is a no-op for an empty exten', () => {
      expect(() => service.handleExtensionStatus({})).not.toThrow();
    });
  });

  describe('getPresenceForTenant', () => {
    it('returns only entries for the requested tenant', () => {
      service.handleDeviceStateChange({ device: 'PJSIP/e110_0', state: 'INUSE' });
      service.handleDeviceStateChange({ device: 'PJSIP/e200_1', state: 'RINGING' });
      jest.advanceTimersByTime(PRESENCE_DEBOUNCE_MS);

      const tenant0 = service.getPresenceForTenant(0);
      expect(tenant0).toHaveLength(1);
      expect(tenant0[0].extension).toBe('110');
    });
  });
});
