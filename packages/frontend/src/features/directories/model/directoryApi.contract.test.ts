import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { rtkApi } from '@/shared/api/rtkApi';
import {
  directoryApi,
  useGetDirectoriesQuery,
  useGetDirectoryQuery,
  useCreateDirectoryMutation,
  useUpdateDirectoryMutation,
  useDeleteDirectoryMutation,
  useImportDirectoryCsvMutation,
  useLookupTestDirectoryMutation,
} from '@/shared/api/endpoints/directoryApi';

function createStore() {
  return configureStore({
    reducer: { [rtkApi.reducerPath]: rtkApi.reducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }).concat(rtkApi.middleware),
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('directoryApi hooks', () => {
  it('exports required management hooks', () => {
    expect(typeof useGetDirectoriesQuery).toBe('function');
    expect(typeof useGetDirectoryQuery).toBe('function');
    expect(typeof useCreateDirectoryMutation).toBe('function');
    expect(typeof useUpdateDirectoryMutation).toBe('function');
    expect(typeof useDeleteDirectoryMutation).toBe('function');
    expect(typeof useImportDirectoryCsvMutation).toBe('function');
    expect(typeof useLookupTestDirectoryMutation).toBe('function');
  });
});

describe('directoryApi contracts', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes('/lookup-test')) {
        return Promise.resolve(jsonResponse({
          status: 'FOUND',
          matchKind: 'exact',
          values: ['Alice'],
        }));
      }
      if (url.includes('/import-csv')) {
        return Promise.resolve(jsonResponse({ imported: 1 }));
      }
      if (url.match(/\/directories\/\d+$/) && (init?.method ?? 'GET') === 'GET') {
        return Promise.resolve(jsonResponse({
          uid: 7,
          user_uid: 1,
          name: 'VIP',
          lookup_field_uid: 3,
          key_normalization: 'digits',
          revision: 1,
        }));
      }
      return Promise.resolve(jsonResponse([]));
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function lastCall(): Promise<{ url: string; method: string; body: unknown }> {
    const [input, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
      RequestInfo | URL,
      RequestInit | undefined,
    ];
    if (input instanceof Request) {
      const text = input.bodyUsed ? '' : await input.clone().text();
      return {
        url: input.url,
        method: input.method.toUpperCase(),
        body: text ? JSON.parse(text) : undefined,
      };
    }
    const raw = init?.body;
    return {
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      body: raw ? JSON.parse(String(raw)) : undefined,
    };
  }

  it('lists directories at GET /directories', async () => {
    const store = createStore();
    await store.dispatch(directoryApi.endpoints.getDirectories.initiate());
    const call = await lastCall();
    expect(call.method).toBe('GET');
    expect(call.url).toMatch(/\/directories$/);
    expect(call.url).not.toContain('/phonebooks');
  });

  it('loads one directory at GET /directories/:id', async () => {
    const store = createStore();
    await store.dispatch(directoryApi.endpoints.getDirectory.initiate(7));
    const call = await lastCall();
    expect(call.method).toBe('GET');
    expect(call.url).toMatch(/\/directories\/7$/);
  });

  it('creates at POST /directories', async () => {
    const store = createStore();
    await store.dispatch(directoryApi.endpoints.createDirectory.initiate({
      name: 'VIP',
      lookupFieldKey: 'phone',
      key_normalization: 'digits',
      fields: [{ key: 'phone', label: 'Phone', type: 'phone', required: true, position: 0 }],
    }));
    const call = await lastCall();
    expect(call.method).toBe('POST');
    expect(call.url).toMatch(/\/directories$/);
    expect(call.body).toMatchObject({ name: 'VIP', lookupFieldKey: 'phone' });
  });

  it('updates at PUT /directories/:id', async () => {
    const store = createStore();
    await store.dispatch(directoryApi.endpoints.updateDirectory.initiate({
      uid: 7,
      data: { name: 'VIP 2' },
    }));
    const call = await lastCall();
    expect(call.method).toBe('PUT');
    expect(call.url).toMatch(/\/directories\/7$/);
  });

  it('deletes at DELETE /directories/:id', async () => {
    const store = createStore();
    await store.dispatch(directoryApi.endpoints.deleteDirectory.initiate(7));
    const call = await lastCall();
    expect(call.method).toBe('DELETE');
    expect(call.url).toMatch(/\/directories\/7$/);
  });

  it('imports CSV at POST /directories/:id/import-csv', async () => {
    const store = createStore();
    await store.dispatch(directoryApi.endpoints.importDirectoryCsv.initiate({
      uid: 7,
      csv: 'phone,comment,match_kind,priority\n100,Alice,exact,1\n',
    }));
    const call = await lastCall();
    expect(call.method).toBe('POST');
    expect(call.url).toMatch(/\/directories\/7\/import-csv$/);
    expect(call.body).toEqual({ csv: 'phone,comment,match_kind,priority\n100,Alice,exact,1\n' });
  });

  it('lookup-test posts { key, fieldUids } and returns directory lookup result', async () => {
    const store = createStore();
    const result = await store.dispatch(directoryApi.endpoints.lookupTestDirectory.initiate({
      uid: 7,
      key: '79001234567',
      fieldUids: [3, 4],
    })).unwrap();

    const call = await lastCall();
    expect(call.method).toBe('POST');
    expect(call.url).toMatch(/\/directories\/7\/lookup-test$/);
    expect(call.body).toEqual({ key: '79001234567', fieldUids: [3, 4] });
    expect(call.body).not.toHaveProperty('number');
    expect(result).toEqual({ status: 'FOUND', matchKind: 'exact', values: ['Alice'] });
    expect(result).not.toHaveProperty('matched');
    expect(result).not.toHaveProperty('vars');
  });

  it('uses DialplanDirectories tags, not Directory or Phonebooks', async () => {
    const store = createStore();
    await store.dispatch(directoryApi.endpoints.getDirectories.initiate());
    const provided = (store.getState() as {
      api: { provided: { tags: Record<string, unknown> } };
    }).api.provided.tags;
    expect(Object.keys(provided)).toContain('DialplanDirectories');
    expect(Object.keys(provided)).not.toContain('Phonebooks');
    expect(Object.keys(provided)).not.toContain('Directory');
  });
});
