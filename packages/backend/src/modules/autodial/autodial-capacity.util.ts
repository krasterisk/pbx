import type { AutodialDialMode, IAutodialPacingConfig } from '@krasterisk/shared';

export interface AutodialCapacityInputs {
  dialMode: AutodialDialMode;
  pacing: IAutodialPacingConfig;
  /** Currently live channels for this campaign (dialing + talking) */
  activeChannels: number;
  /** Channels the pacer already promised this tick but has not originated yet */
  reserved: number;
  /** Sum of READY agents across the campaign's queues */
  availableAgents: number;
  /** Free channels left in the campaign's trunk pool; null = provider unusable */
  freeTrunkChannels: number | null;
  /** Tenant-wide live autodial channels across all campaigns */
  tenantActiveChannels: number;
  /** Tenant-wide reservations, including other campaigns */
  tenantReservedChannels?: number;
  /** True while CallCenterStateService or ARI is not trustworthy yet */
  degraded?: boolean;
  /** Predictive mode: over-dial multiplier from the abandon-rate controller */
  overDial?: number;
}

export interface AutodialCapacityResult {
  /** How many new calls may be originated right now */
  slots: number;
  /** Provider that produced the binding limit, for the monitor UI */
  limitedBy: string;
  /** Effective concurrent ceiling for this campaign at this instant */
  capacity: number;
}

/**
 * Each provider contributes NEW available slots. Static limits count active
 * channels; trunk availability and tenant remaining capacity already account
 * for them. A campaign whose queue-agent data is not warm yet gets zero slots
 * rather than a blind guess — dialing without knowing agent state is exactly
 * how abandon rate explodes.
 */
export function computeAutodialCapacity(
  input: AutodialCapacityInputs,
): AutodialCapacityResult {
  const providers = input.pacing?.providers ?? [];
  const limits: Array<{ name: string; value: number }> = [];

  for (const provider of providers) {
    switch (provider.type) {
      case 'static':
        limits.push({
          name: 'static',
          value: Math.max(0, provider.max_channels - input.activeChannels - input.reserved),
        });
        break;
      case 'queue_agents': {
        if (input.degraded) {
          return { slots: 0, limitedBy: 'queue_agents_warmup', capacity: 0 };
        }
        const ratio = agentRatio(input, provider.ratio);
        // Live calls may still need an agent; until connection is tracked,
        // reserve one slot for each as a conservative upper bound.
        limits.push({
          name: 'queue_agents',
          value: Math.max(0, Math.floor(input.availableAgents * ratio)
            - input.activeChannels - input.reserved),
        });
        break;
      }
      case 'trunk_channels':
        if (input.freeTrunkChannels != null) {
          limits.push({ name: 'trunk_channels', value: Math.max(0, input.freeTrunkChannels) });
        }
        break;
      case 'tenant_cap':
        limits.push({
          name: 'tenant_cap',
          value: Math.max(0, provider.max_channels - input.tenantActiveChannels
            - (input.tenantReservedChannels ?? input.reserved)),
        });
        break;
    }
  }

  if (!limits.length) {
    return { slots: 0, limitedBy: 'no_providers', capacity: 0 };
  }

  const binding = limits.reduce((min, cur) => (cur.value < min.value ? cur : min));
  const slots = binding.value;
  return {
    slots,
    limitedBy: binding.name,
    capacity: input.activeChannels + input.reserved + slots,
  };
}

/**
 * Calls allowed per free agent. Power takes the operator's fixed ratio;
 * predictive takes whatever the abandon-rate controller currently permits, so
 * the multiplier moves between ticks instead of being configured once.
 */
function agentRatio(input: AutodialCapacityInputs, providerRatio?: number): number {
  if (input.dialMode === 'power') {
    return Math.max(1, providerRatio ?? input.pacing.power_ratio ?? 1);
  }
  if (input.dialMode === 'predictive') {
    return Math.max(1, input.overDial ?? 1);
  }
  return 1;
}

/** Agentless campaigns never wait for operators, so the provider is dropped. */
export function effectivePacing(
  dialMode: AutodialDialMode,
  pacing: IAutodialPacingConfig,
): IAutodialPacingConfig {
  if (dialMode !== 'agentless') return pacing;
  const providers = (pacing.providers ?? []).filter(
    (p: IAutodialPacingConfig['providers'][number]) => p.type !== 'queue_agents',
  );
  return {
    ...pacing,
    providers: providers.length ? providers : [{ type: 'static', max_channels: 1 }],
  };
}
