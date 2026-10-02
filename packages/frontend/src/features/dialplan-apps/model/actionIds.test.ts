import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IRouteAction } from '@krasterisk/shared';
import { createActionId, ensureActionIds } from './actionIds';

afterEach(() => vi.unstubAllGlobals());

describe('action IDs on HTTP and imported routes', () => {
  it('creates distinct IDs when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    expect(createActionId()).not.toBe(createActionId());
  });

  it('adds missing and duplicate IDs without changing the original actions', () => {
    vi.stubGlobal('crypto', undefined);
    const actions = [
      { type: 'voicerobot', params: { robot_uid: 1 } },
      { id: 'saved', type: 'hangup', params: {}, condition: {} },
      { id: 'saved', type: 'hangup', params: {}, condition: {} },
    ] as IRouteAction[];

    const normalized = ensureActionIds(actions);
    expect(normalized.map((action) => action.id)).toHaveLength(3);
    expect(new Set(normalized.map((action) => action.id)).size).toBe(3);
    expect(normalized[0].params).toEqual({ robot_uid: 1 });
    expect(normalized[0].condition).toEqual({});
    expect(normalized[1]).toBe(actions[1]);
    expect(actions[0].id).toBeUndefined();
  });
});
