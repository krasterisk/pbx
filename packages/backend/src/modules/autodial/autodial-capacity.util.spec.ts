import { computeAutodialCapacity, effectivePacing } from './autodial-capacity.util';
import type { AutodialCapacityInputs } from './autodial-capacity.util';

function inputs(over: Partial<AutodialCapacityInputs> = {}): AutodialCapacityInputs {
  return {
    dialMode: 'progressive',
    pacing: { providers: [{ type: 'static', max_channels: 10 }] },
    activeChannels: 0,
    reserved: 0,
    availableAgents: 0,
    freeTrunkChannels: null,
    tenantActiveChannels: 0,
    ...over,
  };
}

describe('computeAutodialCapacity', () => {
  it('takes the minimum across providers', () => {
    const result = computeAutodialCapacity(
      inputs({
        pacing: {
          providers: [
            { type: 'static', max_channels: 10 },
            { type: 'tenant_cap', max_channels: 4 },
          ],
        },
      }),
    );
    expect(result.capacity).toBe(4);
    expect(result.limitedBy).toBe('tenant_cap');
    expect(result.slots).toBe(4);
  });

  it('subtracts live channels and reservations from the limit', () => {
    const result = computeAutodialCapacity(inputs({ activeChannels: 6, reserved: 2 }));
    expect(result.slots).toBe(2);
  });

  it('never returns negative slots when in-flight exceeds the limit', () => {
    const result = computeAutodialCapacity(inputs({ activeChannels: 25 }));
    expect(result.slots).toBe(0);
  });

  it('gives progressive one call per free agent', () => {
    const result = computeAutodialCapacity(
      inputs({
        pacing: { providers: [{ type: 'queue_agents', queue_names: ['sales'] }] },
        availableAgents: 3,
      }),
    );
    expect(result.slots).toBe(3);
  });

  it('multiplies free agents by the ratio in power mode', () => {
    const result = computeAutodialCapacity(
      inputs({
        dialMode: 'power',
        pacing: {
          providers: [{ type: 'queue_agents', queue_names: ['sales'] }],
          power_ratio: 2,
        },
        availableAgents: 3,
      }),
    );
    expect(result.slots).toBe(6);
  });

  it('counts reserved agents as taken before applying the ratio', () => {
    const result = computeAutodialCapacity(
      inputs({
        dialMode: 'power',
        pacing: {
          providers: [{ type: 'queue_agents', queue_names: ['sales'] }],
          power_ratio: 2,
        },
        availableAgents: 3,
        reserved: 1,
      }),
    );
    // (3 - 1) * 2 = 4 allowed, 1 already in flight
    expect(result.slots).toBe(3);
  });

  it('multiplies free agents by the controller factor in predictive mode', () => {
    const result = computeAutodialCapacity(
      inputs({
        dialMode: 'predictive',
        pacing: { providers: [{ type: 'queue_agents', queue_names: ['sales'] }] },
        availableAgents: 4,
        overDial: 1.5,
      }),
    );
    expect(result.slots).toBe(6);
  });

  it('ignores power_ratio in predictive mode and falls back to 1:1 without a factor', () => {
    const result = computeAutodialCapacity(
      inputs({
        dialMode: 'predictive',
        pacing: {
          providers: [{ type: 'queue_agents', queue_names: ['sales'] }],
          power_ratio: 3,
        },
        availableAgents: 4,
      }),
    );
    expect(result.slots).toBe(4);
  });

  it('refuses to dial on queue_agents while agent state is warming up', () => {
    const result = computeAutodialCapacity(
      inputs({
        pacing: { providers: [{ type: 'queue_agents', queue_names: ['sales'] }] },
        availableAgents: 5,
        degraded: true,
      }),
    );
    expect(result.slots).toBe(0);
    expect(result.limitedBy).toBe('queue_agents_warmup');
  });

  it('drops the trunk provider when no trunk declares a limit', () => {
    const result = computeAutodialCapacity(
      inputs({
        pacing: {
          providers: [{ type: 'static', max_channels: 5 }, { type: 'trunk_channels' }],
        },
        freeTrunkChannels: null,
      }),
    );
    expect(result.capacity).toBe(5);
    expect(result.limitedBy).toBe('static');
  });

  it('binds on free trunk channels when they are the tightest limit', () => {
    const result = computeAutodialCapacity(
      inputs({
        pacing: {
          providers: [{ type: 'static', max_channels: 20 }, { type: 'trunk_channels' }],
        },
        freeTrunkChannels: 2,
      }),
    );
    expect(result.capacity).toBe(2);
    expect(result.limitedBy).toBe('trunk_channels');
  });

  it('dials nothing when no provider is configured', () => {
    const result = computeAutodialCapacity(inputs({ pacing: { providers: [] } }));
    expect(result.slots).toBe(0);
    expect(result.limitedBy).toBe('no_providers');
  });
});

describe('effectivePacing', () => {
  it('strips queue_agents for agentless campaigns', () => {
    const result = effectivePacing('agentless', {
      providers: [
        { type: 'queue_agents', queue_names: ['sales'] },
        { type: 'static', max_channels: 8 },
      ],
    });
    expect(result.providers).toEqual([{ type: 'static', max_channels: 8 }]);
  });

  it('leaves a usable provider behind when queue_agents was the only one', () => {
    const result = effectivePacing('agentless', {
      providers: [{ type: 'queue_agents', queue_names: ['sales'] }],
    });
    expect(result.providers).toEqual([{ type: 'static', max_channels: 1 }]);
  });

  it('leaves operator-backed modes untouched', () => {
    const pacing = { providers: [{ type: 'queue_agents' as const, queue_names: ['sales'] }] };
    expect(effectivePacing('progressive', pacing)).toBe(pacing);
  });
});
