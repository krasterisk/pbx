export const DEFAULT_QUALIFY_FREQUENCY = 120;
export const DEFAULT_REGISTRATION_EXPIRATION = 600;

/** OPTIONS interval in seconds. 0 disables qualify. */
export function resolveQualifyFrequency(value?: number | null): number {
  if (value == null || Number.isNaN(Number(value))) return DEFAULT_QUALIFY_FREQUENCY;
  return Math.max(0, Math.min(3600, Math.floor(Number(value))));
}

/** Outbound REGISTER Expires in seconds. */
export function resolveRegistrationExpiration(value?: number | null): number {
  if (value == null || Number.isNaN(Number(value))) return DEFAULT_REGISTRATION_EXPIRATION;
  return Math.max(60, Math.min(86400, Math.floor(Number(value))));
}
