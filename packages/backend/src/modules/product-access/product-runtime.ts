export type ProductRuntime =
  | 'community-core'
  | 'not-installed'
  | 'entitled-not-installed'
  | 'installed'
  | 'expired';

export type ProductRuntimeInput = {
  profile: string;
  schemaReady: boolean;
  workersConfigured: boolean;
  entitled: boolean;
  expired: boolean;
  allowed: boolean;
};

export function readProcessInstallFlags(env: NodeJS.Dict<string> = process.env): {
  schemaReady: boolean;
  workersConfigured: boolean;
} {
  return {
    schemaReady: env.AI_SCHEMA_READY === '1',
    workersConfigured: env.AI_WORKERS_CONFIGURED === '1',
  };
}

export function resolveProductRuntime(input: ProductRuntimeInput): {
  productRuntime: ProductRuntime;
  usable: boolean;
} {
  if (input.profile === 'community-pbx' || input.profile === 'community-core') {
    return { productRuntime: 'community-core', usable: true };
  }
  if (input.expired) {
    return { productRuntime: 'expired', usable: false };
  }
  const processReady = input.schemaReady && input.workersConfigured;
  if (input.entitled && processReady) {
    return { productRuntime: 'installed', usable: input.allowed };
  }
  if (input.entitled) {
    return { productRuntime: 'entitled-not-installed', usable: false };
  }
  return { productRuntime: 'not-installed', usable: false };
}

export function entitledFromDecision(decision: { allowed: boolean; reason: string | null }): {
  entitled: boolean;
  expired: boolean;
} {
  const expired = decision.reason === 'license_expired' || decision.reason === 'entitlement_expired';
  const entitled = decision.allowed || decision.reason === 'product_disabled' || expired;
  return { entitled, expired };
}

/** Offline BOX profile must not require a license heartbeat. */
export function offlineHeartbeatPolicy(env: NodeJS.Dict<string> = process.env): {
  required: false;
  outbound: false;
} {
  if (env.AI_LICENSE_PROFILE === 'offline' && env.AI_LICENSE_HEARTBEAT === '1') {
    throw Object.assign(new Error('offline profile forbids mandatory license heartbeat'), {
      code: 'license_heartbeat_forbidden',
    });
  }
  return { required: false, outbound: false };
}
