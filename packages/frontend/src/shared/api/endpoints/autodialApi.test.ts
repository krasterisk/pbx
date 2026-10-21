import { configureStore } from '@reduxjs/toolkit';
import type { FetchArgs } from '@reduxjs/toolkit/query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autodialApi, autodialExportUrl } from './autodialApi';

const mocks = vi.hoisted(() => ({ baseQuery: vi.fn(), requests: [] as FetchArgs[] }));
vi.mock('../rtkApi', async () => {
  const { createApi } = await import('@reduxjs/toolkit/query/react');
  return { rtkApi: createApi({ reducerPath: 'autodialCacheTest', baseQuery: mocks.baseQuery,
    tagTypes: ['AutodialBases', 'AutodialContacts', 'AutodialCampaigns', 'AutodialDnc', 'AutodialReports', 'AutodialImportProfiles', 'TtsEngines'],
    endpoints: () => ({}) }) };
});
const stores: Array<ReturnType<typeof makeStore>> = [];
function makeStore() {
  return configureStore({ reducer: { [autodialApi.reducerPath]: autodialApi.reducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(autodialApi.middleware) });
}
beforeEach(() => {
  mocks.requests.length = 0;
  mocks.baseQuery.mockImplementation(async (arg: string | FetchArgs) => {
    const request = typeof arg === 'string' ? { url: arg } : arg;
    mocks.requests.push(request);
    if (request.url.includes('scenario-preview')) return { data: { base_uid: 7, steps: [], variables: [] } };
    if (request.url.includes('monitor-health')) return { data: { campaigns: [] } };
    if (request.url === '/autodial/monitor') return { data: [] };
    return { data: { items: [], total: 0, page: 1, page_size: 25 } };
  });
});
afterEach(() => { for (const store of stores.splice(0)) store.dispatch(autodialApi.util.resetApiState()); });
const count = (path: string) => mocks.requests.filter((request) => !request.method && request.url.startsWith(path)).length;

describe('autodial live cache dependencies', () => {
  it('refreshes an empty campaign and its preview after contact writes without refetching an unrelated base', async () => {
    const store = makeStore(); stores.push(store);
    await Promise.all([
      store.dispatch(autodialApi.endpoints.getAutodialContacts.initiate({ baseUid: 7 })),
      store.dispatch(autodialApi.endpoints.getAutodialContacts.initiate({ baseUid: 8 })),
      store.dispatch(autodialApi.endpoints.getAutodialCampaignContacts.initiate({ uid: 2, baseUid: 7 })),
      store.dispatch(autodialApi.endpoints.getAutodialScenarioPreview.initiate({ uid: 2, baseUid: 7 })),
    ]);
    await store.dispatch(autodialApi.endpoints.updateAutodialContact.initiate({ baseUid: 7, contactUid: 1, data: { comment: 'Updated' } })).unwrap();
    await vi.waitFor(() => {
      expect(count('/autodial/campaigns/2/contacts')).toBe(2);
      expect(count('/autodial/campaigns/2/scenario-preview')).toBe(2);
      expect(count('/autodial/bases/7/contacts')).toBe(2);
    });
    expect(count('/autodial/bases/8/contacts')).toBe(1);
    await store.dispatch(autodialApi.endpoints.importAutodialFile.initiate({ baseUid: 7, content_base64: 'YSxiCg==' })).unwrap();
    await vi.waitFor(() => expect(count('/autodial/campaigns/2/contacts')).toBe(3));
    expect(count('/autodial/bases/8/contacts')).toBe(1);
  });
  it('refreshes an already open monitor when a campaign is created', async () => {
    const store = makeStore(); stores.push(store);
    await Promise.all([store.dispatch(autodialApi.endpoints.getAutodialMonitor.initiate()),
      store.dispatch(autodialApi.endpoints.getAutodialMonitorHealth.initiate())]);
    store.dispatch(autodialApi.util.invalidateTags([{ type: 'AutodialCampaigns', id: 'LIST' }]));
    await vi.waitFor(() => {
      expect(count('/autodial/monitor-health')).toBe(2);
      expect(mocks.requests.filter((r) => r.url === '/autodial/monitor')).toHaveLength(2);
    });
  });
});

describe('authenticated report download', () => {
  it('keeps a browser command identity in its header and out of the strict resource DTO', async () => {
    const store = makeStore(); stores.push(store);
    await store.dispatch(autodialApi.endpoints.createAutodialBase.initiate({ name: 'Test',
      fields: [{ key: 'phone', label: 'Phone', type: 'phone', is_phone: true }], ui_command_id: 'test-command-0001' })).unwrap();
    const request = mocks.requests.at(-1)!;
    expect(request.headers).toEqual({ 'Idempotency-Key': 'test-command-0001' });
    expect(request.body).not.toHaveProperty('ui_command_id');
    expect(request.timeout).toBe(30000);
  });
  it('sends the complete filter without putting the session token in a URL', async () => {
    localStorage.setItem('accessToken', 'test-session-marker');
    const query = { from: '2026-10-01', to: '2026-10-18', campaigns: [2, 9] };
    expect(autodialExportUrl(query, 'detail', 'xlsx')).not.toMatch(/token|test-session-marker/);
    const store = makeStore(); stores.push(store);
    await store.dispatch(autodialApi.endpoints.downloadAutodialReport.initiate({ query, kind: 'detail', format: 'xlsx' }));
    const request = mocks.requests.at(-1)!;
    const url = new URL(request.url, 'https://test.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({ from: query.from, to: query.to, campaigns: '2,9', kind: 'detail', format: 'xlsx' });
    localStorage.removeItem('accessToken');
  });
});
