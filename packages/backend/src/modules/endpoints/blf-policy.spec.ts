import { blfContext, blfSettings, buildBlfHints, subscriptionsEnabled } from './blf-policy';

describe('BLF tenant policy', () => {
  it('defaults off and overrides arbitrary contexts with tenant ownership', () => {
    expect(blfSettings(undefined, 42)).toEqual({ allow_subscribe: 'no', subscribe_context: 'krsk-blf-42' });
    expect(blfSettings('true', 0)).toEqual({ allow_subscribe: 'yes', subscribe_context: 'krsk-blf-0' });
    expect(subscriptionsEnabled('no')).toBe(false);
    expect(() => blfContext(-1)).toThrow();
  });

  it('combines primary and WebRTC, rejects other tenants, guests and dialplan injection', () => {
    expect(buildBlfHints(['e201_42', 'ew201_42', 'e202_42', 'e201_7', 'gst123', 'e1,1,System(x)_42', 'ew203_42'], 42)).toEqual([
      'exten => 201,hint,PJSIP/e201_42&PJSIP/ew201_42',
      'exten => 202,hint,PJSIP/e202_42',
    ]);
  });
});
