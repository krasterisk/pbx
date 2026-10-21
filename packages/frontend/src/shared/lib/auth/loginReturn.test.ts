import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLoginReturn, consumeLoginReturn, LOGIN_RETURN_KEY, normalizeLoginReturnPath, rememberLoginReturn } from './loginReturn';
const user = { uniqueid: 4, vpbx_user_uid: 0 };
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());
describe('local one-time login destination', () => {
  it.each(['/autodial?filter=100%25#metrics', '/autodial?name=%D0%A2%D0%B5%D1%81%D1%82', '/autodial?name=two%20words'])('retains valid encoded query values %s', (path) => {
    expect(normalizeLoginReturnPath(path)).toBe(path);
  });
  it('rejects every raw ASCII control and backslash', () => {
    for (const code of [...Array.from({ length: 33 }, (_, index) => index), 92, 127]) {
      expect(normalizeLoginReturnPath('/autodial/' + String.fromCharCode(code))).toBeNull();
    }
  });
  it('rejects obfuscated credential parameter names', () => {
    expect(normalizeLoginReturnPath('/autodial?%2574oken=secret')).toBeNull();
  });
  it.each(['/', '/v4/', '/nested/pbx/'])('strips browser basename exactly once: %s', (base) => {
    const path = base.replace(/\/$/, '') + '/autodial/bases?base=12&tab=fields#schema';
    expect(normalizeLoginReturnPath(path, base)).toBe('/autodial/bases?base=12&tab=fields#schema');
    rememberLoginReturn(path, user, base); expect(consumeLoginReturn(user)).toBe('/autodial/bases?base=12&tab=fields#schema');
    expect(consumeLoginReturn(user)).toBeNull();
  });
  it.each(['https://evil.test/', '//evil.test/x', '/\\evil.test', '/%2f%2fevil.test', '/autodial/../platform', '/autodial/%2e%2e/platform', '/autodial/%252e%252e/platform', '/login', '/register?x=1', '/activate', '/reset-password', '/platform/tenants', '/superadmin', '/standalone', '/conf/private', '/autodial\n/x', '/autodial%0a/x', '/autodial?access_token=secret', '/autodial?password=secret', '/autodial#refresh_token=secret', '/autodial?api_key=secret', '/autodial%'])('rejects unsafe/auth/credential destination %s', (path) => {
    expect(normalizeLoginReturnPath(path)).toBeNull(); rememberLoginReturn(path, user); expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).toBeNull();
  });
  it('rejects paths outside the deployed basename', () => {
    expect(normalizeLoginReturnPath('/autodial', '/v4/')).toBeNull();
    expect(normalizeLoginReturnPath('/v4evil/autodial', '/v4/')).toBeNull();
  });
  it.each([{ uniqueid: 5, vpbx_user_uid: 0 }, { uniqueid: 4, vpbx_user_uid: 1 }])('drops expired-session return on account/tenant change', (other) => {
    rememberLoginReturn('/autodial', user); expect(consumeLoginReturn(other)).toBeNull(); expect(sessionStorage.getItem(LOGIN_RETURN_KEY)).toBeNull();
  });
  it('allows a cold unauthenticated link, then consumes it once', () => {
    rememberLoginReturn('/autodial'); expect(consumeLoginReturn(user)).toBe('/autodial'); expect(consumeLoginReturn(user)).toBeNull();
  });
  it.each([0, Date.now() + 60_000])('discards stale or future entries (%s)', (at) => {
    rememberLoginReturn('/autodial', user, '/', at); expect(consumeLoginReturn(user)).toBeNull();
  });
  it('handles malformed storage and explicit clearing', () => {
    sessionStorage.setItem(LOGIN_RETURN_KEY, '{broken'); expect(consumeLoginReturn(user)).toBeNull();
    rememberLoginReturn('/autodial', user); clearLoginReturn(); expect(consumeLoginReturn(user)).toBeNull();
  });
  it('does not prevent login when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => rememberLoginReturn('/autodial', user)).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(consumeLoginReturn(user)).toBeNull();
  });
});
