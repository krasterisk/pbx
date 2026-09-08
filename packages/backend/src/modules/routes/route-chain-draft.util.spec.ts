import { validateRouteChainDraft, type TenantEntityRefs } from './route-chain-draft.util';

const REFS: TenantEntityRefs = {
  queues: [{ name: 'sales', exten: '100' }],
  extensions: [{ extension: '201', sipUsername: 'e201_100' }],
  trunks: [{ id: 't_mtt_100', name: 'MTT' }],
  ivrs: [{ uid: 7, name: 'Main' }],
  routes: [{ uid: 11, name: 'Inbound' }],
  contexts: [{ uid: 3, name: 'from-internal' }],
  directories: [{ uid: 4 }],
  groups: [{ uid: 5, name: 'Sales', exten: '701' }],
};

describe('validateRouteChainDraft', () => {
  it('accepts a typed chain the route editor can open', () => {
    const result = validateRouteChainDraft(
      [
        {
          type: 'toqueue',
          params: { target: { source: 'fixed', value: 'sales' } },
          condition: {},
        },
        { type: 'hangup', params: { signal: 'hangup' }, condition: {} },
      ],
      REFS,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.chain).toHaveLength(2);
    expect(result.chain[0]).toEqual(
      expect.objectContaining({
        type: 'toqueue',
        params: { target: { source: 'fixed', value: 'sales' } },
      }),
    );
    expect(result.chain[0].id).toEqual(expect.any(String));
    expect(result.chain[1].type).toBe('hangup');
  });

  it('refuses an unknown action kind and names the failing step', () => {
    const result = validateRouteChainDraft(
      [
        { type: 'toqueue', params: { queue: 'sales' }, condition: {} },
        { type: 'Dial', params: { appdata: 'PJSIP/e201_100,30' }, condition: {} },
      ],
      REFS,
    );

    expect(result).toEqual(
      expect.objectContaining({ ok: false, stepIndex: 1 }),
    );
    if (result.ok) return;
    expect(result.reason).toMatch(/Dial|unknown|kind|type/i);
  });

  it('refuses a missing required parameter and names the failing step', () => {
    const result = validateRouteChainDraft(
      [{ type: 'toqueue', params: {}, condition: {} }],
      REFS,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stepIndex).toBe(0);
    expect(result.reason).toMatch(/target|queue|required|missing/i);
  });

  it('refuses a reference to an entity that is not in the tenant catalog', () => {
    const result = validateRouteChainDraft(
      [
        {
          type: 'toivr',
          params: { ivr_uid: 99 },
          condition: {},
        },
      ],
      REFS,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stepIndex).toBe(0);
    expect(result.reason).toMatch(/99|ivr|exist/i);
  });

  it('does not accept the raw application-and-arguments form', () => {
    const result = validateRouteChainDraft(
      [{ app: 'Queue', appdata: 'sales' }],
      REFS,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.stepIndex).toBe(0);
    expect(result.reason).toMatch(/type|kind|app/i);
  });

  it('accepts a tenant call group for togroup and refuses a foreign group id', () => {
    const ok = validateRouteChainDraft(
      [{ type: 'togroup', params: { target: { source: 'fixed', value: '5' } }, condition: {} }],
      REFS,
    );
    expect(ok.ok).toBe(true);

    const refused = validateRouteChainDraft(
      [{ type: 'togroup', params: { target: { source: 'fixed', value: '99' } }, condition: {} }],
      REFS,
    );
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toMatch(/99|group|exist/i);
  });
});
