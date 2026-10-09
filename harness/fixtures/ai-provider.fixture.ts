import { test as base } from './llm-stub.fixture';

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

export const test = base.extend<{ stubProvider: { uid: number } }>({
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
        auth_type: 'none',
        enabled: true,
      }),
    });
    const uid = created.uid;
    await apiJson(authSession.accessToken, '/ai-chat/default-provider', {
      method: 'PUT',
      body: JSON.stringify({ providerUid: uid }),
    });
    let createdContextUid: number | undefined;
    try {
      // Endpoint plans require an explicit tenant-owned default context. CI seed
      // deliberately contains no PBX contexts; do not bypass production validation.
      const contexts = await apiJson<Array<{ uid: number; is_default_for_endpoints?: boolean }>>(
        authSession.accessToken, '/contexts',
      );
      if (!contexts.some((context) => context.is_default_for_endpoints)) {
        const context = await apiJson<{ uid: number }>(authSession.accessToken, '/contexts', {
          method: 'POST',
          body: JSON.stringify({
            name: 'harness-ai-' + uid,
            comment: 'Isolated AI plan fixture',
            is_default_for_endpoints: true,
          }),
        });
        createdContextUid = context.uid;
        const configured = await apiJson<Array<{ uid: number; is_default_for_endpoints?: boolean }>>(
          authSession.accessToken, '/contexts',
        );
        if (!configured.some((row) => row.uid === context.uid && row.is_default_for_endpoints)) {
          throw new Error('AI fixture default context was not persisted');
        }
      }
      await use({ uid });
      const previousUid = previous.providerUid;
      // True restore of “no default” needs a backend clear path (out of D2).
      // Skip-when-null leaves settings.defaultProviderUid pointing at the deleted stub.
      // Next teardown would PUT that ghost uid and findOne 404s. Guard: never PUT the
      // stub we are about to DELETE, and skip restore if the previous provider is gone.
      if (typeof previousUid === 'number' && previousUid > 0 && previousUid !== uid) {
        const probe = await fetch(`${API}/api/ai-agents/providers/${previousUid}`, {
          headers: authHeaders(authSession.accessToken),
        });
        if (probe.ok) {
          await apiJson(authSession.accessToken, '/ai-chat/default-provider', {
            method: 'PUT',
            body: JSON.stringify({ providerUid: previousUid }),
          });
        }
      }
    } finally {
      try {
        if (createdContextUid !== undefined) {
          await apiJson(authSession.accessToken, '/contexts/' + createdContextUid, { method: 'DELETE' });
        }
      } finally {
        await apiJson(authSession.accessToken, `/ai-agents/providers/${uid}`, { method: 'DELETE' });
      }
    }
  }, { scope: 'worker' }],
});

export { expect } from '@playwright/test';
