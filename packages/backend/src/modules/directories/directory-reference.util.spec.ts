import { collectDirectoryReferences } from './directory-reference.util';

describe('collectDirectoryReferences', () => {
  const binding = {
    uid: 3,
    route_uid: 5,
    directory_uid: 7,
    user_uid: 100,
    behavior_type: 'set_number',
    behavior_params: { fieldUid: 17 },
    actions: null as unknown[] | null,
  };

  const lookupAction = {
    id: 'a1',
    type: 'directory_lookup',
    params: {
      directoryUid: 7,
      keySource: { source: 'original_caller' },
      outputs: [{ fieldUid: 17, targetVariable: 'CID_NUM' }],
      onMissing: 'keep',
    },
    condition: {},
  };

  const carouselAction = {
    id: 'a2',
    type: 'totrunk',
    params: {
      trunks: [
        {
          trunkId: 'pjsip-1',
          callerId: {
            mode: 'directory',
            directoryUid: 7,
            valueFieldUid: 17,
            keySource: { source: 'original_caller' },
            onMissing: 'keep_original',
          },
        },
      ],
    },
    condition: {},
  };

  const otherDirAction = {
    id: 'a3',
    type: 'directory_lookup',
    params: {
      directoryUid: 99,
      keySource: { source: 'original_caller' },
      outputs: [{ fieldUid: 50, targetVariable: 'X' }],
      onMissing: 'keep',
    },
    condition: {},
  };

  it('returns route UID, action/binding id, and a human-readable location for a binding', () => {
    const refs = collectDirectoryReferences(7, undefined, [binding], []);
    expect(refs).toEqual([
      {
        routeUid: 5,
        actionOrBindingId: '3',
        location: expect.stringMatching(/route\s*5/i),
      },
    ]);
    expect(refs[0].location).toMatch(/binding/i);
  });

  it('finds directoryUid and fieldUid inside route actions JSON', () => {
    const refs = collectDirectoryReferences(
      7,
      17,
      [],
      [{ uid: 5, actions: [lookupAction, otherDirAction] }],
    );
    expect(refs).toEqual([
      {
        routeUid: 5,
        actionOrBindingId: 'a1',
        location: expect.stringMatching(/route\s*5/i),
      },
    ]);
    expect(refs[0].location.toLowerCase()).toMatch(/action/);
  });

  it('finds valueFieldUid nested in a carousel callerId', () => {
    const refs = collectDirectoryReferences(
      7,
      17,
      [],
      [{ uid: 9, actions: [carouselAction] }],
    );
    expect(refs).toEqual([
      expect.objectContaining({
        routeUid: 9,
        actionOrBindingId: 'a2',
        location: expect.any(String),
      }),
    ]);
  });

  it('scans binding actions as well as the binding row', () => {
    const customBinding = {
      ...binding,
      uid: 4,
      behavior_type: 'custom',
      behavior_params: { fieldUid: 17 },
      actions: [lookupAction],
    };
    const refs = collectDirectoryReferences(7, 17, [customBinding], []);
    expect(refs.map((r) => r.actionOrBindingId).sort()).toEqual(['4', 'a1']);
    expect(refs.every((r) => r.routeUid === 5)).toBe(true);
    expect(refs.every((r) => typeof r.location === 'string' && r.location.length > 0)).toBe(true);
  });

  it('does not treat a directory-only binding as a field reference', () => {
    const dirOnly = {
      ...binding,
      behavior_params: { fixed: '100' },
    };
    expect(collectDirectoryReferences(7, 17, [dirOnly], [])).toEqual([]);
    expect(collectDirectoryReferences(7, undefined, [dirOnly], [])).toHaveLength(1);
  });

  it('ignores other directories and other field UIDs', () => {
    expect(
      collectDirectoryReferences(7, 18, [binding], [{ uid: 5, actions: [lookupAction] }]),
    ).toEqual([]);
    expect(collectDirectoryReferences(99, undefined, [binding], [])).toEqual([]);
  });
});
