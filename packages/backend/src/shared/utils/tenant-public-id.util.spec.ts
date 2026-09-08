import { isTenantTechnicalId, toPublicExten, toPublicMemberInterface } from './tenant-public-id.util';

describe('toPublicExten', () => {
  it('strips tenant-scoped queue and SIP ids so create tools receive the public number', () => {
    expect(toPublicExten('q701_0')).toBe('701');
    expect(toPublicExten('e102_0')).toBe('102');
    expect(toPublicExten('ew112_42')).toBe('112');
    expect(toPublicExten('701_0', 0)).toBe('701');
  });

  it('leaves a public number or display name unchanged', () => {
    expect(toPublicExten('701')).toBe('701');
    expect(toPublicExten('Поддержка')).toBe('Поддержка');
  });
});

describe('toPublicMemberInterface', () => {
  it('strips a tenant SIP id inside a PJSIP channel', () => {
    expect(toPublicMemberInterface('PJSIP/e201_100', 100)).toBe('PJSIP/201');
    expect(toPublicMemberInterface('e201_100')).toBe('201');
  });
});

describe('isTenantTechnicalId', () => {
  it('detects Asterisk tenant ids that must not be shown to the operator', () => {
    expect(isTenantTechnicalId('q701_0')).toBe(true);
    expect(isTenantTechnicalId('e102_0')).toBe(true);
    expect(isTenantTechnicalId('701')).toBe(false);
  });
});
