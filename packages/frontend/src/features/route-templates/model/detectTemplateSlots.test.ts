import { describe, expect, it } from 'vitest';
import { templateSlotMarker, type IRouteAction } from '@krasterisk/shared';
import { buildTemplatePayload, detectTemplateSlots } from './detectTemplateSlots';

function action(partial: Partial<IRouteAction> & Pick<IRouteAction, 'id' | 'type'>): IRouteAction {
  return { params: {}, condition: {}, ...partial };
}

describe('detectTemplateSlots', () => {
  it('finds queue, group, ivr, trunk, recording and directory refs', () => {
    const found = detectTemplateSlots([
      action({
        id: 'q',
        type: 'toqueue',
        params: { target: { source: 'fixed', value: 'sales' }, announceoverride: 'welcome' },
      }),
      action({ id: 'g', type: 'togroup', params: { group: '12' } }),
      action({ id: 'i', type: 'toivr', params: { ivr_uid: '7' } }),
      action({ id: 't', type: 'totrunk', params: { trunk: 'mgts' } }),
      action({ id: 'p', type: 'playback', params: { files: 'after-hours' } }),
      action({ id: 'd', type: 'directory_lookup', params: { directoryUid: 3 } }),
    ]);

    expect(found.map((item) => item.kind).sort()).toEqual(
      ['directory', 'group', 'ivr', 'queue', 'recording', 'recording', 'trunk'].sort(),
    );
  });

  it('skips hangup-only chains and existing slot markers', () => {
    expect(detectTemplateSlots([action({ id: 'h', type: 'hangup', params: { signal: 'hangup' } })])).toEqual([]);
    expect(
      detectTemplateSlots([
        action({
          id: 'q',
          type: 'toqueue',
          params: { target: { source: 'fixed', value: templateSlotMarker('queue') } },
        }),
      ]),
    ).toEqual([]);
  });

  it('replaces checked refs with slot markers and leaves unchecked values', () => {
    const actions = [
      action({ id: 'q', type: 'toqueue', params: { target: { source: 'fixed', value: 'sales' } } }),
      action({ id: 'g', type: 'togroup', params: { group: '12' } }),
    ];
    const candidates = detectTemplateSlots(actions);
    const queue = candidates.find((item) => item.kind === 'queue')!;
    const payload = buildTemplatePayload(actions, [queue.id], candidates);

    expect(queue.id).not.toContain('.');
    expect(payload.slots).toEqual([{ id: queue.id, kind: 'queue', label: 'sales' }]);
    expect(payload.actions[0].params).toEqual({
      target: { source: 'fixed', value: templateSlotMarker(queue.id) },
    });
    expect(payload.actions[1].params).toEqual({ group: '12' });
  });

  it('labels a tenant queue id with the bare exten and keeps the stored value', () => {
    const found = detectTemplateSlots([
      action({
        id: 'q',
        type: 'toqueue',
        params: { target: { source: 'fixed', value: 'q700_0' } },
      }),
    ]);
    const queue = found.find((item) => item.kind === 'queue');
    expect(queue?.label).toBe('700');
    expect(queue?.value).toBe('q700_0');
  });
});
