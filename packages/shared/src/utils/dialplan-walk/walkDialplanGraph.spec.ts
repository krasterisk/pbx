import { DEFAULT_HOP_LIMIT, resolveHopDecision } from '../dialplan-hops';
import { walkDialplanGraph } from './walkDialplanGraph';
import type { WalkAction, WalkMenuItem, WalkResolvedIvr } from './types';

function playback(id: string): WalkAction {
  return { id, type: 'playback', params: { files: ['beep'] }, condition: {} };
}

function toivr(id: string, ivrUid: number): WalkAction {
  return { id, type: 'toivr', params: { ivr_uid: ivrUid }, condition: {} };
}

function callback(id: string): WalkAction {
  return { id, type: 'callback', params: {}, condition: {} };
}

describe('walkDialplanGraph (D-45 hop ≠ step)', () => {
  it('20 consecutive passthrough playback actions consume zero hops and the walk continues', () => {
    const actions = Array.from({ length: 20 }, (_, i) => playback(`pb-${i}`));
    const result = walkDialplanGraph({ host: 'route', actions });

    expect(result.hopLimit).toBe(DEFAULT_HOP_LIMIT);
    expect(result.hopsUsed).toBe(0);
    expect(result.outcome.kind).not.toBe('congestion');
    const visited = result.segments.flatMap((segment) => segment.nodes.map((node) => node.actionId));
    expect(visited).toHaveLength(20);
    expect(visited[0]).toBe('pb-0');
    expect(visited[19]).toBe('pb-19');
  });

  it('11th resolvable toivr jump yields Congestion at DEFAULT_HOP_LIMIT and marks the loop without stopping early (D-45)', () => {
    const resolveIvr = (ivrUid: number): WalkResolvedIvr | undefined => {
      if (ivrUid === 1) {
        return {
          uid: 1,
          name: 'LoopA',
          menu_items: [{ digit: '1', actions: [toivr('to-b', 2)] }],
        };
      }
      if (ivrUid === 2) {
        return {
          uid: 2,
          name: 'LoopB',
          menu_items: [{ digit: '1', actions: [toivr('to-a', 1)] }],
        };
      }
      return undefined;
    };

    const result = walkDialplanGraph({
      host: 'route',
      actions: [toivr('start', 1)],
      resolveIvr,
      ivrChoice: '1',
    });

    expect(result.hopLimit).toBe(DEFAULT_HOP_LIMIT);
    expect(resolveHopDecision(DEFAULT_HOP_LIMIT)).toBe('exceed');
    expect(result.hopsUsed).toBe(DEFAULT_HOP_LIMIT);
    expect(result.outcome.kind).toBe('congestion');
    expect(result.breadcrumbs.some((crumb) => crumb.loop === true)).toBe(true);
    // Early stop on first repeat would leave hopsUsed at 2–3, not the live Congestion budget.
    expect(result.hopsUsed).toBeGreaterThan(3);
  });
});

describe('walkDialplanGraph (D-47 reask)', () => {
  it('returns reask with one source key when QUEUESTATUS is required and missing', () => {
    const actions: WalkAction[] = [
      {
        id: 'after-queue',
        type: 'hangup',
        params: {},
        condition: { source: 'queuestatus', values: ['TIMEOUT'] },
      },
    ];

    const result = walkDialplanGraph({ host: 'route', actions, scenario: {} });

    expect(result.reask).toBeDefined();
    expect(result.reask!.source).toBe('queuestatus');
    expect(result.reask!.keys).toEqual(['queuestatus']);
  });
});

describe('walkDialplanGraph (D-43 IVR host inputs)', () => {
  it('exposes timeout (t) and invalid (i) inputs even when those menu handlers are absent', () => {
    const menu_items: WalkMenuItem[] = [
      { digit: '1', actions: [{ id: 'hang', type: 'hangup', params: {}, condition: {} }] },
    ];

    const result = walkDialplanGraph({ host: 'ivr', menu_items });

    expect(result.ivrInputs).toBeDefined();
    expect(result.ivrInputs!.available).toEqual(expect.arrayContaining(['t', 'i', '1']));
    expect(menu_items.some((item) => item.digit === 't' || item.digit === 'i')).toBe(false);
  });
});

describe('walkDialplanGraph (D-38 callback)', () => {
  it('stops on terminal callback with outcome callback_requested and consumes no hop', () => {
    const result = walkDialplanGraph({
      host: 'route',
      actions: [playback('prompt'), callback('cb-1'), { id: 'after', type: 'hangup', params: {}, condition: {} }],
    });

    expect(result.outcome.kind).toBe('callback_requested');
    expect(result.hopsUsed).toBe(0);
    const visited = result.segments.flatMap((segment) => segment.nodes.map((node) => node.actionId));
    expect(visited).toContain('cb-1');
    expect(visited).not.toContain('after');
  });
});
