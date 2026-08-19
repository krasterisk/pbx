import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { rtkApi } from '@/shared/api/rtkApi';
import { tenantSettingsApi } from './tenantSettingsApi';
import { TENANT_SETTINGS_DEFAULTS, type TenantSettings } from '../model/types/tenantSettings';

const INITIAL: TenantSettings = {
  'routes.show_raw_dialplan': true,
  'routes.show_flowchart': true,
};

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

function selectCached(store: ReturnType<typeof createStore>): TenantSettings | undefined {
  return tenantSettingsApi.endpoints.getVpbxTenantSettings.select(undefined)(store.getState()).data;
}

describe('tenantSettingsApi (D-19, D-17)', () => {
  let putGate: {
    resolve: (value: Response) => void;
    reject: (reason?: unknown) => void;
    promise: Promise<Response>;
  };

  beforeEach(() => {
    let resolve!: (value: Response) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<Response>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    putGate = { resolve, reject, promise };

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input);
        const method = (input instanceof Request ? input.method : init?.method ?? 'GET').toUpperCase();
        if (url.includes('/tenant-settings') && method === 'PUT') {
          return putGate.promise;
        }
        if (url.includes('/tenant-settings')) {
          return Promise.resolve(jsonResponse(INITIAL));
        }
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('useGetTenantSettingsQuery cache includes all keys with D-17 defaults', async () => {
    const store = createStore();
    const data = await store
      .dispatch(tenantSettingsApi.endpoints.getVpbxTenantSettings.initiate())
      .unwrap();
    expect(data).toMatchObject(TENANT_SETTINGS_DEFAULTS);
    expect(data['routes.show_raw_dialplan']).toBe(true);
    expect(data['routes.show_flowchart']).toBe(true);
  });

  it('patches getVpbxTenantSettings cache before the PUT resolves', async () => {
    const store = createStore();
    store.dispatch(tenantSettingsApi.util.upsertQueryData('getVpbxTenantSettings', undefined, INITIAL));

    const pending = store.dispatch(
      tenantSettingsApi.endpoints.updateVpbxTenantSettings.initiate({
        'routes.show_raw_dialplan': false,
      }),
    );

    expect(selectCached(store)?.['routes.show_raw_dialplan']).toBe(false);

    putGate.resolve(jsonResponse({
      'routes.show_raw_dialplan': false,
      'routes.show_flowchart': true,
    }));
    await pending;
  });

  it('undo() restores the pre-mutation cache snapshot when PUT is rejected', async () => {
    const store = createStore();
    store.dispatch(tenantSettingsApi.util.upsertQueryData('getVpbxTenantSettings', undefined, INITIAL));
    const before = structuredClone(selectCached(store));

    const pending = store.dispatch(
      tenantSettingsApi.endpoints.updateVpbxTenantSettings.initiate({
        'routes.show_raw_dialplan': false,
      }),
    );

    expect(selectCached(store)?.['routes.show_raw_dialplan']).toBe(false);

    putGate.resolve(jsonResponse({ message: 'fail' }, 500));
    await pending.catch(() => undefined);

    expect(selectCached(store)).toEqual(before);
  });

  it('replaces the optimistic patch with the server payload on success', async () => {
    const store = createStore();
    store.dispatch(tenantSettingsApi.util.upsertQueryData('getVpbxTenantSettings', undefined, INITIAL));

    const server: TenantSettings = {
      'routes.show_raw_dialplan': true,
      'routes.show_flowchart': false,
    };

    const pending = store.dispatch(
      tenantSettingsApi.endpoints.updateVpbxTenantSettings.initiate({
        'routes.show_raw_dialplan': false,
      }),
    );

    putGate.resolve(jsonResponse(server));
    await pending;

    expect(selectCached(store)).toEqual(server);
  });

  it('does not list foreign cache tags on the mutation', () => {
    const def = tenantSettingsApi.endpoints.updateVpbxTenantSettings;
    const raw = JSON.stringify(def);
    expect(raw).not.toContain('CcSettings');
    expect(raw).not.toContain('ServerConfig');
  });
});
