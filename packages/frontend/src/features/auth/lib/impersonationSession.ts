const SESSION_KEY = 'krasterisk.impersonation';

export interface ImpersonationSession {
  tenantId: number;
  tenantName: string;
}

export function rememberImpersonation(tenant: { id: number; name: string }): void {
  const storage = browserStorage();
  if (!storage) return;
  const session: ImpersonationSession = { tenantId: tenant.id, tenantName: tenant.name };
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearImpersonation(): void {
  const storage = browserStorage();
  if (!storage) return;
  storage.removeItem(SESSION_KEY);
  storage.removeItem('impersonation_token');
}

/** Active only while the access token itself carries impersonated_by. */
export function readImpersonation(accessToken: string | null | undefined): ImpersonationSession | null {
  if (!tokenIsImpersonation(accessToken)) return null;
  const stored = readStoredSession();
  return stored ?? { tenantId: 0, tenantName: '' };
}

export function readImpersonatedIdentity(
  accessToken: string | null | undefined,
): ImpersonatedIdentity | null {
  if (!accessToken || !tokenIsImpersonation(accessToken)) return null;
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;
  const uniqueid = payload.sub;
  const name = payload.name;
  const login = payload.login;
  if (typeof uniqueid !== 'number' || typeof name !== 'string' || !name.trim()) return null;
  return {
    uniqueid,
    login: typeof login === 'string' ? login : '',
    name,
    level: typeof payload.level === 'number' ? payload.level : 1,
    role: typeof payload.role === 'number' ? payload.role : 0,
    vpbx_user_uid: typeof payload.vpbx_user_uid === 'number' ? payload.vpbx_user_uid : 0,
  };
}

export interface ImpersonatedIdentity {
  uniqueid: number;
  login: string;
  name: string;
  level: number;
  role: number;
  vpbx_user_uid: number;
}

/** Replace the stored profile so the shell shows the cabinet user, not the superadmin. */
export function persistImpersonatedUser(user: {
  uniqueid: number;
  login: string;
  name: string;
  level: number;
  role?: number;
  vpbx_user_uid?: number;
}): void {
  const storage = browserStorage();
  if (!storage) return;
  let previous: Record<string, unknown> = {};
  try {
    previous = JSON.parse(storage.getItem('user') || 'null') ?? {};
  } catch {
    previous = {};
  }
  storage.setItem('user', JSON.stringify({
    ...previous,
    uniqueid: user.uniqueid,
    login: user.login,
    name: user.name,
    level: user.level,
    role: user.role ?? 0,
    vpbx_user_uid: user.vpbx_user_uid ?? previous.vpbx_user_uid ?? 0,
    exten: '',
    avatar: null,
  }));
}

/** True when this access token is a superadmin session inside a tenant cabinet. */
export function accessTokenIsImpersonation(accessToken: string | null | undefined): boolean {
  return tokenIsImpersonation(accessToken);
}

function tokenIsImpersonation(accessToken: string | null | undefined): boolean {
  if (!accessToken) return false;
  const payload = decodeJwtPayload(accessToken);
  const by = payload?.impersonated_by;
  return typeof by === 'number' && Number.isFinite(by);
}

function readStoredSession(): ImpersonationSession | null {
  const storage = browserStorage();
  if (!storage) return null;
  const raw = storage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ImpersonationSession>;
    if (typeof parsed.tenantName !== 'string' || !Number.isFinite(parsed.tenantId)) return null;
    return { tenantId: parsed.tenantId!, tenantName: parsed.tenantName };
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    const binary = atob(padded + pad);
    // JWT JSON is UTF-8; atob returns Latin-1 code units for each byte.
    const utf8 = Array.from(binary, (ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`).join('');
    return JSON.parse(decodeURIComponent(utf8)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
