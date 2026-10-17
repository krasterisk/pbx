import { InteractiveSessionService } from './interactive-session.service';

describe('Interactive autodial confirmation proof', () => {
  const service = new InteractiveSessionService({ get: (name: string) => name === 'JWT_SECRET' ? 'test-only-interactive-secret-at-least-32-characters' : 'test' } as never);
  const result = { accessToken: 'access-1', refreshToken: 'refresh-1', user: { uniqueid: 71, vpbx_user_uid: 7 } } as never;
  const issue = () => {
    let cookie = ''; const res = { cookie: jest.fn((name, value) => { cookie = `${name}=${value}`; }) };
    service.issue(res as never, result, { secure: false }); return { cookie, res };
  };
  const request = (cookie?: string, token = 'access-1') => ({ headers: { cookie, authorization: `Bearer ${token}` }, user: { sub: 71, vpbx_user_uid: 7 } });
  it('requires password-issued HttpOnly SameSite proof bound to both token and identity', () => {
    expect(() => service.assert(request() as never)).toThrow();
    const { cookie, res } = issue();
    expect(res.cookie).toHaveBeenCalledWith('krsk_interactive', expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/api' }));
    expect(() => service.assert(request(cookie) as never)).not.toThrow();
    expect(() => service.assert(request(cookie, 'other-token') as never)).toThrow();
    expect(() => service.assert({ ...request(cookie), user: { sub: 72, vpbx_user_uid: 7 } } as never)).toThrow();
    expect(() => service.assert(request(cookie.slice(0, -4) + 'AAAA') as never)).toThrow();
    expect(() => service.assert({ ...request(cookie), headers: { ...request(cookie).headers, 'sec-fetch-site': 'cross-site' } } as never)).toThrow();
    expect(() => service.assert({ ...request(cookie), user: { sub: 71, vpbx_user_uid: 7, integration_key_uid: 1 } } as never)).toThrow();
  });
  it('cannot mint or rotate proof using refresh token alone', () => {
    const res = { cookie: jest.fn() };
    service.rotate(request() as never, res as never, 'refresh-1', result);
    service.rotate(request(issue().cookie) as never, res as never, 'wrong-refresh', result);
    expect(res.cookie).not.toHaveBeenCalled();
    service.rotate(request(issue().cookie) as never, res as never, 'refresh-1', result);
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });
  it('supports the valid PBX tenant zero without allowing another tenant', () => {
    let cookie = '';
    service.issue({ cookie: (name: string, value: string) => { cookie = `${name}=${value}`; } } as never,
      { accessToken: 'access-1', refreshToken: 'refresh-1', user: { uniqueid: 71, vpbx_user_uid: 0 } } as never, { secure: false });
    expect(() => service.assert({ ...request(cookie), user: { sub: 71, vpbx_user_uid: 0 } } as never)).not.toThrow();
    expect(() => service.assert(request(cookie) as never)).toThrow();
  });
});
