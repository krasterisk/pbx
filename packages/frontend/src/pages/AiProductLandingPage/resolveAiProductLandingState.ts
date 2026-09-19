export type AiProductLandingState =
  | 'pending'
  | 'locked'
  | 'expired'
  | 'notInstalled'
  | 'disabled'
  | 'unavailable'
  | 'notConfigured'
  | 'ready';

export function resolveAiProductLandingState(input: {
  loading: boolean;
  allowed?: boolean;
  reason?: string | null;
  licenseStatus?: 'active' | 'locked' | 'disabled';
  configured: boolean;
}): AiProductLandingState {
  if (input.loading) return 'pending';
  const reason = input.reason ?? null;
  if (reason === 'package_missing') return 'notInstalled';
  if (reason === 'runtime_unavailable') return 'unavailable';
  if (reason === 'entitlement_expired' || reason === 'license_expired') return 'expired';
  if (reason === 'product_disabled' || input.licenseStatus === 'disabled') return 'disabled';
  if (input.allowed) return input.configured ? 'ready' : 'notConfigured';
  if (input.licenseStatus === 'active') return input.configured ? 'ready' : 'notConfigured';
  return 'locked';
}
