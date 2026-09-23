import { selectAutodialTrunk, selectAutodialTrunkLegs } from './autodial-trunk.util';

describe('selectAutodialTrunk', () => {
  it('returns null for an empty pool so the caller can fail the task', () => {
    expect(selectAutodialTrunk([], { mode: 'per_trunk' }, '79001234567', 0)).toBeNull();
  });

  it('ignores entries without a trunk id', () => {
    expect(
      selectAutodialTrunk([{ trunk_id: '' }], { mode: 'per_trunk' }, '79001234567', 0),
    ).toBeNull();
  });

  it('builds a direct PJSIP endpoint so cause codes arrive undistorted', () => {
    const target = selectAutodialTrunk(
      [{ trunk_id: 'mtt' }],
      { mode: 'per_trunk' },
      '79001234567',
      0,
    );
    expect(target?.endpoint).toBe('PJSIP/79001234567@mtt');
  });

  it('rotates across trunks as the cursor advances', () => {
    const pool = [{ trunk_id: 'a' }, { trunk_id: 'b' }];
    const seen = [0, 1, 2, 3].map(
      (cursor) => selectAutodialTrunk(pool, { mode: 'per_trunk' }, '7900', cursor)?.trunkId,
    );
    expect(seen).toEqual(['a', 'b', 'a', 'b']);
  });

  it('honours weights when rotating', () => {
    const pool = [{ trunk_id: 'a', weight: 3 }, { trunk_id: 'b' }];
    const seen = [0, 1, 2, 3].map(
      (cursor) => selectAutodialTrunk(pool, { mode: 'per_trunk' }, '7900', cursor)?.trunkId,
    );
    expect(seen).toEqual(['a', 'a', 'a', 'b']);
  });

  it('never selects a trunk that pacing marked unavailable', () => {
    const target = selectAutodialTrunk(
      [{ trunk_id: 'saturated' }, { trunk_id: 'free' }],
      { mode: 'per_trunk' },
      '7900',
      0,
      new Set(['free']),
    );
    expect(target?.trunkId).toBe('free');
  });

  it('takes the caller id from the trunk in per_trunk mode', () => {
    const target = selectAutodialTrunk(
      [{ trunk_id: 'mtt', caller_id: '74951112233' }],
      { mode: 'per_trunk' },
      '7900',
      0,
    );
    expect(target?.callerId).toBe('74951112233');
  });

  it('uses the fixed value in static mode regardless of the trunk', () => {
    const target = selectAutodialTrunk(
      [{ trunk_id: 'mtt', caller_id: '74951112233' }],
      { mode: 'static', value: '74959998877' },
      '7900',
      0,
    );
    expect(target?.callerId).toBe('74959998877');
  });

  it('cycles the caller id pool in rotate mode', () => {
    const pool = [{ trunk_id: 'mtt' }];
    const policy = { mode: 'rotate' as const, pool: ['7495111', '7495222'] };
    expect(selectAutodialTrunk(pool, policy, '7900', 0)?.callerId).toBe('7495111');
    expect(selectAutodialTrunk(pool, policy, '7900', 1)?.callerId).toBe('7495222');
  });

  it('uses a Caller ID list assigned to this trunk before the legacy campaign policy', () => {
    const trunk = {
      trunk_id: 'mtt',
      caller_id: '74950000000',
      caller_id_source: {
        mode: 'pool' as const,
        numbers: ['7495111', '7495222'],
        pick: 'round_robin' as const,
      },
    };

    expect(selectAutodialTrunk([trunk], { mode: 'static', value: '79990000000' }, '7900', 0)?.callerId)
      .toBe('7495111');
    expect(selectAutodialTrunk([trunk], { mode: 'static', value: '79990000000' }, '7900', 1)?.callerId)
      .toBe('7495222');
  });

  it('keeps a directory source for the originator while retaining its fallback Caller ID', () => {
    const target = selectAutodialTrunk(
      [{
        trunk_id: 'mtt',
        caller_id: '74950000000',
        caller_id_source: {
          mode: 'directory',
          directory_uid: 5,
          value_field_uid: 17,
          key: { source: 'autodial_field', field_key: 'region' },
          on_missing: 'fallback',
        },
      }],
      { mode: 'per_trunk' },
      '7900',
      0,
    );

    expect(target?.callerId).toBe('74950000000');
    expect(target?.callerIdSource).toEqual(expect.objectContaining({ mode: 'directory' }));
  });

  it('falls back to the policy value when the rotate pool is empty', () => {
    const target = selectAutodialTrunk(
      [{ trunk_id: 'mtt' }],
      { mode: 'rotate', pool: [], value: '74950000000' },
      '7900',
      0,
    );
    expect(target?.callerId).toBe('74950000000');
  });

  it('reports no caller id rather than an empty string when none is configured', () => {
    const target = selectAutodialTrunk([{ trunk_id: 'mtt' }], { mode: 'per_trunk' }, '7900', 0);
    expect(target?.callerId).toBeNull();
  });
});

describe('selectAutodialTrunkLegs', () => {
  it('returns the weighted primary first and unique remaining trunks after it', () => {
    const legs = selectAutodialTrunkLegs(
      [{ trunk_id: 'a' }, { trunk_id: 'b' }, { trunk_id: 'a' }, { trunk_id: 'c' }],
      { mode: 'per_trunk' },
      '7900',
      0,
    );
    expect(legs.map((leg) => leg.trunkId)).toEqual(['a', 'b', 'c']);
  });

  it('does not add a saturated trunk as a failover leg', () => {
    const legs = selectAutodialTrunkLegs(
      [{ trunk_id: 'a' }, { trunk_id: 'b' }],
      { mode: 'per_trunk' },
      '7900',
      0,
      new Set(['a']),
    );
    expect(legs.map((leg) => leg.trunkId)).toEqual(['a']);
  });
});
