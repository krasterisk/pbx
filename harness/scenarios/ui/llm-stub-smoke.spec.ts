import { expect, test } from '../../fixtures/ai-provider.fixture';

const API = (process.env.HARNESS_API_URL || 'http://localhost:5010').replace(/\/$/, '');

async function apiJson<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${await res.text().catch(() => '')}`);
  }
  return res.json() as Promise<T>;
}

test('the stub provider becomes the default chat provider', async ({ stubProvider, authSession }) => {
  const current = await apiJson<{ providerUid: number }>(authSession.accessToken, '/ai-chat/default-provider');
  expect(current.providerUid).toBe(stubProvider.uid);
});
