import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiFetch, apiRequest } from '../../assertions/http.js';
import { loginAndGetToken } from '../../environment/seed.js';

/**
 * @tags directories api
 * Directory CRUD: fields internal_number / cid_alpha / cid_beta,
 * exact + pattern lookup, foreign tenant reject, delete.
 */
describe('Directories CRUD /api/directories', () => {
  let token: string;
  let createdUid: number;
  let lookupFieldUid: number;
  let cidAlphaUid: number;
  const harnessName = `HarnessDir ${Date.now()}`;

  beforeAll(async () => {
    token = await loginAndGetToken();
  });

  afterAll(async () => {
    if (createdUid && token) {
      await apiRequest(`/api/directories/${createdUid}`, { method: 'DELETE', token }).catch(
        () => undefined,
      );
    }
  });

  it('POST creates a directory with internal_number, cid_alpha, and cid_beta', async () => {
    const { status, data } = await apiFetch<{
      uid: number;
      name: string;
      fields: Array<{ uid: number; key: string }>;
    }>('/api/directories', {
      method: 'POST',
      token,
      body: {
        name: harnessName,
        description: 'Harness directory',
        lookupFieldKey: 'internal_number',
        key_normalization: 'digits',
        fields: [
          { key: 'internal_number', label: 'Internal', type: 'phone', required: true, position: 0 },
          { key: 'cid_alpha', label: 'CID Alpha', type: 'phone', required: false, position: 1 },
          { key: 'cid_beta', label: 'CID Beta', type: 'phone', required: false, position: 2 },
        ],
        records: [
          {
            match_kind: 'exact',
            priority: 1,
            values: { internal_number: '100', cid_alpha: '700', cid_beta: '800' },
          },
          {
            match_kind: 'asterisk_pattern',
            priority: 10,
            values: { internal_number: '_1XX', cid_alpha: '701', cid_beta: '801' },
          },
        ],
      },
    });

    expect([200, 201]).toContain(status);
    expect(data.uid).toBeGreaterThan(0);
    createdUid = data.uid;
    lookupFieldUid = data.fields.find((f) => f.key === 'internal_number')!.uid;
    cidAlphaUid = data.fields.find((f) => f.key === 'cid_alpha')!.uid;
    expect(data.fields.map((f) => f.key).sort()).toEqual(['cid_alpha', 'cid_beta', 'internal_number']);
  });

  it('lookup-test matches exact 100 before the _1XX pattern', async () => {
    expect(createdUid).toBeDefined();
    const { data } = await apiFetch<{
      status: string;
      matchKind?: string;
      values: string[];
    }>(`/api/directories/${createdUid}/lookup-test`, {
      method: 'POST',
      token,
      body: { key: '100', fieldUids: [lookupFieldUid, cidAlphaUid] },
    });
    expect(data.status).toBe('FOUND');
    expect(data.matchKind).toBe('exact');
    expect(data.values[1]).toBe('700');
  });

  it('lookup-test matches the _1XX pattern when exact misses', async () => {
    expect(createdUid).toBeDefined();
    const { data } = await apiFetch<{
      status: string;
      matchKind?: string;
      values: string[];
    }>(`/api/directories/${createdUid}/lookup-test`, {
      method: 'POST',
      token,
      body: { key: '101', fieldUids: [lookupFieldUid, cidAlphaUid] },
    });
    expect(data.status).toBe('FOUND');
    expect(data.matchKind).toBe('asterisk_pattern');
    expect(data.values[1]).toBe('701');
  });

  it('rejects a foreign tenant lookup without revealing the record', async () => {
    expect(createdUid).toBeDefined();
    const foreign = await apiRequest<{
      status?: string;
      values?: string[];
    }>(`/api/directories/${createdUid}/lookup-test`, {
      method: 'POST',
      token: 'not-a-valid-foreign-token',
      body: { key: '100', fieldUids: [lookupFieldUid] },
    });
    expect(foreign.ok).toBe(false);
    expect([401, 403]).toContain(foreign.status);

    const otherUser = process.env.HARNESS_FOREIGN_USER;
    const otherPass = process.env.HARNESS_FOREIGN_PASS;
    if (otherUser && otherPass) {
      const foreignToken = await loginAndGetToken(otherUser, otherPass);
      const peek = await apiRequest(`/api/directories/${createdUid}`, { token: foreignToken });
      expect(peek.status).toBe(404);
    }
  });

  it('DELETE removes the directory', async () => {
    expect(createdUid).toBeDefined();
    const del = await apiRequest(`/api/directories/${createdUid}`, { method: 'DELETE', token });
    expect(del.ok).toBe(true);
    expect([200, 204]).toContain(del.status);

    const gone = await apiRequest(`/api/directories/${createdUid}`, { token });
    expect(gone.status).toBe(404);
    createdUid = 0;
  });
});
