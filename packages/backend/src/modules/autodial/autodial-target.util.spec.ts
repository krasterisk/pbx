import { autodialExtensionTarget, autodialQueueTarget } from './autodial-target.util';

describe('autodial tenant destination contract', () => {
  it('maps public queue catalog values but preserves legacy queue aliases', () => {
    expect(autodialQueueTarget({ target: { source: 'fixed', value: '800' } }, 7)).toBe('q800_7');
    expect(autodialQueueTarget({ target: { source: 'fixed', value: 'q800_7' } }, 7)).toBe('q800_7');
    expect(autodialQueueTarget({ queue: 'legacy-sales' }, 7)).toBe('legacy-sales');
  });
  it('maps public extensions to the tenant endpoint pair, respecting WebRTC', () => {
    expect(autodialExtensionTarget({ target: { source: 'fixed', value: '100' } }, 7)).toEqual({ id: 'e100_7', dial: 'PJSIP/e100_7&PJSIP/ew100_7' });
    expect(autodialExtensionTarget({ exten: '100', webrtc: false }, 7).dial).toBe('PJSIP/e100_7');
    expect(autodialExtensionTarget({ exten: 'ew100_7' }, 7).dial).toBe('PJSIP/ew100_7');
  });
  it('rejects foreign realtime targets and injected application syntax', () => {
    expect(() => autodialQueueTarget({ queue: 'q800_8' }, 7)).toThrow('AC_SCENARIO_FOREIGN_TARGET');
    expect(() => autodialExtensionTarget({ exten: 'e100_8' }, 7)).toThrow('AC_SCENARIO_FOREIGN_TARGET');
    expect(() => autodialExtensionTarget({ exten: '100),Hangup(' }, 7)).toThrow();
  });
});
