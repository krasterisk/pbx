import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiFetch, apiRequest } from '../../assertions/http.js';
import { loginAndGetToken } from '../../environment/seed.js';
import { deleteMohByName, registerCleanup } from '../../environment/teardown.js';

/**
 * @tags moh api
 * Full MOH CRUD via public HTTP with Bearer JWT (D-02, D-H02).
 */
describe('MOH CRUD /api/moh', () => {
  let token: string;
  let createdName: string;
  let createdDisplayName: string;
  const harnessLabel = `Harness ${Date.now()}`;

  beforeAll(async () => {
    token = await loginAndGetToken();
    process.env.HARNESS_CLEANUP_TOKEN = token;
  });

  afterAll(async () => {
    if (createdName && token) {
      await deleteMohByName(token, createdName).catch(() => undefined);
    }
  });

  it('POST creates MOH class with entries and returns name', async () => {
    const { status, data } = await apiFetch<{ name: string; displayName: string }>(
      '/api/moh',
      {
        method: 'POST',
        token,
        body: {
          displayName: harnessLabel,
          sort: 'alpha',
          entries: [{ filename: 'silence/1', position: 1 }],
        },
      },
    );

    expect([200, 201]).toContain(status);
    expect(typeof data.name).toBe('string');
    expect(data.name.length).toBeGreaterThan(0);

    createdName = data.name;
    createdDisplayName = data.displayName;
    registerCleanup(createdName, token);
  });

  it('GET by name returns created displayName', async () => {
    expect(createdName).toBeDefined();

    const { data } = await apiFetch<{ displayName: string }>(
      `/api/moh/${encodeURIComponent(createdName)}`,
      { token },
    );

    expect(data.displayName).toBe(createdDisplayName);
  });

  it('PUT updates sort and DELETE removes class', async () => {
    expect(createdName).toBeDefined();

    const { data: updated } = await apiFetch<{ sort: string }>(
      `/api/moh/${encodeURIComponent(createdName)}`,
      {
        method: 'PUT',
        token,
        body: { sort: 'random' },
      },
    );

    expect(updated.sort).toBe('random');

    const del = await apiRequest(
      `/api/moh/${encodeURIComponent(createdName)}`,
      { method: 'DELETE', token },
    );

    expect(del.ok).toBe(true);
    expect([200, 204]).toContain(del.status);

    const gone = await apiRequest(
      `/api/moh/${encodeURIComponent(createdName)}`,
      { token },
    );

    expect(gone.status).toBe(404);
    createdName = '';
  });
});
