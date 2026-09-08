import {
  actionFromIvrDestination,
  destinationFromIvrActions,
  normalizeIvrMenuItems,
  summarizeIvrMenu,
} from './ivr-menu-actions.util';

describe('ivr-menu-actions.util', () => {
  it('maps extension destination to toexten with a public number', () => {
    const action = actionFromIvrDestination({ kind: 'extension', target: 'e101_0' }, { digit: '1' });
    expect(action).toEqual(expect.objectContaining({
      type: 'toexten',
      params: { target: { source: 'fixed', value: '101' }, webrtc: true },
    }));
    expect(destinationFromIvrActions([action])).toEqual({ kind: 'extension', target: '101' });
  });

  it('maps group destination to togroup target, not legacy group', () => {
    const action = actionFromIvrDestination({ kind: 'group', target: '3' }, { digit: 't' });
    expect(action).toEqual(expect.objectContaining({
      type: 'togroup',
      params: { target: { source: 'fixed', value: '3' } },
    }));
    expect(destinationFromIvrActions([action])).toEqual({ kind: 'group', target: '3' });
  });

  it('rewrites persisted dial + legacy togroup.group onto the product schema', () => {
    const result = normalizeIvrMenuItems([
      {
        digit: '1',
        actions: [{ type: 'dial', params: { target: { source: 'fixed', value: 'e102_0' } } }],
      },
      {
        digit: 't',
        actions: [{ type: 'togroup', params: { group: '3' } }],
      },
    ], 42);

    expect(result.unmapped).toEqual([]);
    expect(result.aliases).toEqual(expect.arrayContaining([
      expect.objectContaining({ digit: '1', from: 'dial', to: 'toexten' }),
    ]));
    expect(result.items).toEqual([
      expect.objectContaining({
        digit: '1',
        actions: [expect.objectContaining({
          type: 'toexten',
          params: { target: { source: 'fixed', value: '102' }, webrtc: true },
        })],
      }),
      expect.objectContaining({
        digit: 't',
        actions: [expect.objectContaining({
          type: 'togroup',
          params: { target: { source: 'fixed', value: '3' } },
        })],
      }),
    ]);
    expect(summarizeIvrMenu(result.items)).toBe('1:toexten,t:togroup');
  });

  it('maps destination.kind context to toroute, not goto', () => {
    const result = normalizeIvrMenuItems([
      { digit: '9', destination: { kind: 'context', target: 'from-internal' } },
    ]);
    expect(result.unmapped).toEqual([]);
    expect(result.items[0].actions[0]).toEqual(expect.objectContaining({
      type: 'toroute',
      params: { context: 'from-internal' },
    }));
  });

  it('leaves an unknown action type unmapped so the write path can refuse it', () => {
    const result = normalizeIvrMenuItems([
      { digit: '1', actions: [{ type: 'not-an-app', params: {} }] },
    ]);
    expect(result.unmapped).toEqual([{ digit: '1', type: 'not-an-app' }]);
  });
});
