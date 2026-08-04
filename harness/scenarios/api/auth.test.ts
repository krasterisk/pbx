import { describe, expect, it } from 'vitest';
import { apiFetch, apiRequest, type AuthSession } from '../../assertions/http.js';

/**
 * @tags auth api
 * Precondition: backend running (HARNESS_API_URL, default http://localhost:5010).
 */
const login = process.env.PW_USER ?? 'admin';
const password = process.env.PW_PASS ?? 'admin';

describe('POST /api/auth/login', () => {
  it('returns 200 and accessToken string', async () => {
    const { status, data } = await apiFetch<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: { login, password },
    });

    expect(status).toBe(200);
    expect(typeof data.accessToken).toBe('string');
    expect(data.accessToken.length).toBeGreaterThan(0);
    expect(typeof data.refreshToken).toBe('string');
  });

  it('invalid password returns non-200', async () => {
    const res = await apiRequest<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: { login, password: '__invalid_harness_password__' },
    });

    expect(res.ok).toBe(false);
    expect(res.status).not.toBe(200);
  });

  it('user object includes vpbx_user_uid', async () => {
    const { data } = await apiFetch<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: { login, password },
    });

    expect(data.user).toBeDefined();
    expect(data.user.vpbx_user_uid).toBeDefined();
  });
});
