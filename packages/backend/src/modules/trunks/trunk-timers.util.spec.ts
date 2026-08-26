import {
  DEFAULT_QUALIFY_FREQUENCY,
  DEFAULT_REGISTRATION_EXPIRATION,
  resolveQualifyFrequency,
  resolveRegistrationExpiration,
} from './trunk-timers.util';

describe('trunk-timers.util', () => {
  it('defaults qualify when empty', () => {
    expect(DEFAULT_QUALIFY_FREQUENCY).toBe(120);
    expect(resolveQualifyFrequency(undefined)).toBe(DEFAULT_QUALIFY_FREQUENCY);
    expect(resolveQualifyFrequency(null)).toBe(DEFAULT_QUALIFY_FREQUENCY);
  });

  it('allows disabling OPTIONS with 0', () => {
    expect(resolveQualifyFrequency(0)).toBe(0);
  });

  it('clamps qualify to 0..3600', () => {
    expect(resolveQualifyFrequency(-5)).toBe(0);
    expect(resolveQualifyFrequency(7200)).toBe(3600);
    expect(resolveQualifyFrequency(90.7)).toBe(90);
  });

  it('defaults REGISTER expiration when empty', () => {
    expect(DEFAULT_REGISTRATION_EXPIRATION).toBe(600);
    expect(resolveRegistrationExpiration(undefined)).toBe(DEFAULT_REGISTRATION_EXPIRATION);
  });

  it('clamps REGISTER expiration to 60..86400', () => {
    expect(resolveRegistrationExpiration(10)).toBe(60);
    expect(resolveRegistrationExpiration(200000)).toBe(86400);
  });
});
