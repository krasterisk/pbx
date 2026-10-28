import { missedCallerVariants } from './missed-call-identities';
describe('missed caller identities', () => {
  it('matches international number presentations without changing a country code', () => {
    expect(missedCallerVariants('+7 (999) 000-11-22')).toEqual(['+7 (999) 000-11-22', '79990001122', '+79990001122']);
    expect(missedCallerVariants('79990001122')).toEqual(['79990001122', '+79990001122']);
  });
  it('keeps short extension and non-number identities exact', () => {
    expect(missedCallerVariants('201')).toEqual(['201']);
    expect(missedCallerVariants('+201')).toEqual(['+201']);
    expect(missedCallerVariants('anonymous')).toEqual(['anonymous']);
    expect(missedCallerVariants(' ')).toEqual([]);
  });
});
