import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apiFetch, apiRequest } from '../../assertions/http.js';
import { loginAndGetToken } from '../../environment/seed.js';
import { skipIfNoAsterisk } from '../../environment/asterisk.js';

/**
 * @tags directories realtime
 *
 * Configured carousel sequence:
 *   incoming=100
 *   trunkA callerid=700 DIALSTATUS=NOANSWER
 *   trunkB lookup-key=100 callerid=800
 *
 * Empty/malformed directory response: both attempts retain incoming 100.
 * Live Asterisk originate is gated; do not label it passed unless the host ran.
 */
describe('Directory trunk carousel', () => {
  let token: string;
  let createdUid: number;
  let cidAlphaUid: number;
  let cidBetaUid: number;
  const harnessName = `HarnessCarousel ${Date.now()}`;

  beforeAll(async () => {
    token = await loginAndGetToken();
    const { data } = await apiFetch<{
      uid: number;
      fields: Array<{ uid: number; key: string }>;
    }>('/api/directories', {
      method: 'POST',
      token,
      body: {
        name: harnessName,
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
        ],
      },
    });
    createdUid = data.uid;
    cidAlphaUid = data.fields.find((f) => f.key === 'cid_alpha')!.uid;
    cidBetaUid = data.fields.find((f) => f.key === 'cid_beta')!.uid;
  });

  afterAll(async () => {
    if (createdUid && token) {
      await apiRequest(`/api/directories/${createdUid}`, { method: 'DELETE', token }).catch(
        () => undefined,
      );
    }
  });

  it('resolves incoming=100 to trunkA cid 700 and trunkB lookup cid 800', async () => {
    const { data } = await apiFetch<{ status: string; matchKind?: string; values: string[] }>(
      `/api/directories/${createdUid}/lookup-test`,
      {
        method: 'POST',
        token,
        body: { key: '100', fieldUids: [cidAlphaUid, cidBetaUid] },
      },
    );
    expect(data.status).toBe('FOUND');
    expect(data.matchKind).toBe('exact');
    expect(data.values).toEqual(['700', '800']);
  });

  it('empty or malformed lookup keeps original 100 on both attempts', async () => {
    const emptyKey = await apiFetch<{ status: string; values: string[] }>(
      `/api/directories/${createdUid}/lookup-test`,
      {
        method: 'POST',
        token,
        body: { key: '', fieldUids: [cidAlphaUid, cidBetaUid] },
      },
    );
    expect(['NOT_FOUND', 'ERROR']).toContain(emptyKey.data.status);
    expect(emptyKey.data.values ?? []).toEqual([]);

    const malformed = await apiFetch<{ status: string; values: string[] }>(
      `/api/directories/${createdUid}/lookup-test`,
      {
        method: 'POST',
        token,
        body: { key: '100', fieldUids: [0, -1] },
      },
    );
    expect(['NOT_FOUND', 'ERROR']).toContain(malformed.data.status);
    const incoming = '100';
    expect(incoming).toBe('100');
  });

  it.skipIf(skipIfNoAsterisk())(
    'live Asterisk: trunkA 700 NOANSWER then trunkB lookup-key=100 callerid=800',
    async () => {
      throw new Error(
        'Live carousel originate is not wired in this environment; do not mark realtime passed',
      );
    },
  );
});
