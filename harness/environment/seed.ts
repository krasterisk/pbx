/**
 * API-based seed helpers — public HTTP only (D-15). No SQL / ORM imports.
 */
const DEFAULT_API_URL = 'http://localhost:5010';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: Record<string, unknown>;
}

export interface MohSeedResult {
  name: string;
  displayName: string;
  raw: Record<string, unknown>;
}

function apiUrl(): string {
  return (process.env.HARNESS_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
}

export async function loginAndGetToken(
  login = process.env.PW_USER ?? 'admin',
  password = process.env.PW_PASS ?? 'admin',
): Promise<string> {
  const session = await loginSession(login, password);
  return session.accessToken;
}

export async function loginSession(
  login = process.env.PW_USER ?? 'admin',
  password = process.env.PW_PASS ?? 'admin',
): Promise<AuthSession> {
  const res = await fetch(`${apiUrl()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Login failed (${res.status}): ${body}`);
  }

  return (await res.json()) as AuthSession;
}

/** Create a MOH class via POST /api/moh (RESEARCH Pitfall 3: entries required). */
export async function seedMohClass(
  token: string,
  displayName = 'Harness Seed',
): Promise<MohSeedResult> {
  const res = await fetch(`${apiUrl()}/api/moh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      displayName,
      entries: [{ filename: 'silence/1', position: 1 }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MOH seed failed (${res.status}): ${body}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  const name = String(raw.name ?? raw.className ?? '');
  if (!name) {
    throw new Error('MOH seed response missing name');
  }

  return { name, displayName, raw };
}
