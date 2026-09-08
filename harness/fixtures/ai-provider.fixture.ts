import { test as base } from './auth.fixture';
import { startLlmStub, type LlmStubHandle } from '../llm-stub';

const API = (process.env.HARNESS_API_URL || 'http://localhost:5010').replace(/\/$/, '');

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiJson<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${await res.text().catch(() => '')}`);
  }
  return res.json() as Promise<T>;
}

export const test = base.extend<{ llmStub: LlmStubHandle; stubProvider: { uid: number } }>({
  llmStub: [async ({}, use) => {
    const port = Number(process.env.HARNESS_LLM_STUB_PORT || 5099);
    const handle = await startLlmStub({ port });
    await use(handle);
    await handle.close();
  }, { scope: 'worker' }],

  stubProvider: [async ({ authSession, llmStub }, use) => {
    const previous = await apiJson<{ providerUid: number | null }>(
      authSession.accessToken,
      '/ai-chat/default-provider',
    );
    const created = await apiJson<{ uid: number }>(authSession.accessToken, '/ai-agents/providers', {
      method: 'POST',
      body: JSON.stringify({
        name: 'harness-stub',
        kind: 'custom',
        vendor: 'openai',
        endpoint: llmStub.url,
        capabilities: ['llm', 'tools'],
        pricing: {},
        auth_type: 'none',
        enabled: true,
      }),
    });
    const uid = created.uid;
    await apiJson(authSession.accessToken, '/ai-chat/default-provider', {
      method: 'PUT',
      body: JSON.stringify({ providerUid: uid }),
    });
    await use({ uid });
    try {
      const previousUid = previous.providerUid;
      if (typeof previousUid === 'number' && previousUid > 0) {
        await apiJson(authSession.accessToken, '/ai-chat/default-provider', {
          method: 'PUT',
          body: JSON.stringify({ providerUid: previousUid }),
        });
      }
    } finally {
      await apiJson(authSession.accessToken, `/ai-agents/providers/${uid}`, { method: 'DELETE' });
    }
  }, { scope: 'worker' }],
});

export { expect } from '@playwright/test';
