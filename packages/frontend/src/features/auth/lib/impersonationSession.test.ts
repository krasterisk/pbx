import { describe, it, expect, beforeEach } from 'vitest';
import { clearImpersonation, persistImpersonatedUser, readImpersonatedIdentity, readImpersonation, rememberImpersonation } from './impersonationSession';

function token(payload: Record<string, unknown>): string {
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `header.${body}.sig`;
}

describe('impersonationSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the remembered cabinet only for an impersonation token', () => {
    rememberImpersonation({ id: 12, name: 'Горизонт' });
    const impersonated = token({ sub: 4, impersonated_by: 1 });
    expect(readImpersonation(impersonated)).toEqual({ tenantId: 12, tenantName: 'Горизонт' });
    expect(readImpersonation(token({ sub: 1 }))).toBeNull();
    expect(readImpersonation(null)).toBeNull();
  });

  it('still flags impersonation when the cabinet name was not stored', () => {
    expect(readImpersonation(token({ impersonated_by: 1 }))).toEqual({ tenantId: 0, tenantName: '' });
  });

  it('reads the cabinet user from an impersonation token', () => {
    const impersonated = token({
      sub: 8,
      login: 'horizon',
      name: 'Horizon Admin',
      level: 1,
      role: 0,
      vpbx_user_uid: 8,
      impersonated_by: 1,
    });
    expect(readImpersonatedIdentity(impersonated)).toMatchObject({
      uniqueid: 8,
      name: 'Horizon Admin',
      level: 1,
    });
    expect(readImpersonatedIdentity(token({ sub: 1, name: 'Super Administrator' }))).toBeNull();
  });

  it('stores the cabinet user instead of the superadmin profile', () => {
    localStorage.setItem('user', JSON.stringify({ uniqueid: 1, name: 'Super Administrator', level: 0 }));
    persistImpersonatedUser({ uniqueid: 8, login: 'horizon', name: 'Horizon Admin', level: 1, vpbx_user_uid: 8 });
    expect(JSON.parse(localStorage.getItem('user') || '{}')).toMatchObject({
      uniqueid: 8,
      name: 'Horizon Admin',
      level: 1,
      avatar: null,
    });
  });
  it('decodes UTF-8 Cyrillic names from the JWT payload', () => {
    const payload = {
      sub: 8,
      login: 'admin150',
      name: 'Администратор 150',
      level: 1,
      impersonated_by: 1,
    };
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    expect(readImpersonatedIdentity(`h.${body}.s`)?.name).toBe('Администратор 150');
  });

  it('clears the marker', () => {
    rememberImpersonation({ id: 3, name: 'Acme' });
    localStorage.setItem('impersonation_token', 'jwt');
    clearImpersonation();
    expect(readImpersonation(token({ impersonated_by: 1 }))).toEqual({ tenantId: 0, tenantName: '' });
    expect(localStorage.getItem('impersonation_token')).toBeNull();
  });
});
