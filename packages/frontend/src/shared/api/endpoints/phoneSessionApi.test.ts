import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { phoneSessionApi } from './phoneSessionApi';

describe('phone selector cache identity boundary', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('fetches a separate selector after identity switch without sending a tenant override', async () => {
    let identity = 'tenant7-user42';
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
      urls.push(request.url);
      return new Response(JSON.stringify({ callCenterActive: false, endpoints: [{ id: identity, extension: '101', name: identity, webrtc: false, available: true }] }),
        { headers: { 'Content-Type': 'application/json' } });
    }));
    const store = configureStore({ reducer: { [phoneSessionApi.reducerPath]: phoneSessionApi.reducer, auth: () => ({ accessToken: 'authored-test-token' }) },
      middleware: (getDefault) => getDefault().concat(phoneSessionApi.middleware) });
    const first = store.dispatch(phoneSessionApi.endpoints.phoneEndpoints.initiate('7:42'));
    expect((await first.unwrap()).endpoints[0].name).toBe('tenant7-user42');
    identity = 'tenant8-user43';
    const second = store.dispatch(phoneSessionApi.endpoints.phoneEndpoints.initiate('8:43'));
    expect((await second.unwrap()).endpoints[0].name).toBe('tenant8-user43');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(urls[1]);
    expect(urls.every((url) => !new URL(url).search)).toBe(true);
    first.unsubscribe(); second.unsubscribe(); store.dispatch(phoneSessionApi.util.resetApiState());
  });
});
