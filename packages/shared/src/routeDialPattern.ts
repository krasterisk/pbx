export interface RouteDialPattern { extension: string; callerId?: string }
export const ROUTE_DIAL_RULE_MAX_LENGTH = 160;
export function isDialPattern(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 79) return false;
  if (!value.startsWith('_')) return /^[A-Za-z0-9+*#-]+$/.test(value);
  return /^_(?:[0-9A-Za-z+*#-]|\[[0-9A-Za-z+*#-]+\])*(?:[.!])?$/.test(value) && value !== '_';
}
export function parseRouteDialPattern(value: string): RouteDialPattern {
  if (typeof value !== 'string' || value.length > ROUTE_DIAL_RULE_MAX_LENGTH) throw new Error('Invalid dial rule');
  const parts = value.split('/');
  if (parts.length > 2 || !isDialPattern(parts[0]) || (parts.length === 2 && parts[1] !== '' && !isDialPattern(parts[1]))) throw new Error('Invalid extension or Caller ID pattern');
  return { extension: parts[0], ...(parts.length === 2 ? { callerId: parts[1] } : {}) };
}
export function serializeRouteDialPattern(rule: RouteDialPattern): string {
  const value = rule.extension + (rule.callerId !== undefined ? '/' + rule.callerId : '');
  parseRouteDialPattern(value);
  return value;
}
export function isRouteDialPattern(value: unknown): value is string {
  try { parseRouteDialPattern(value as string); return true; } catch { return false; }
}
export function validateRouteDialPatterns(values: unknown): asserts values is string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 100 || !values.every(isRouteDialPattern)) throw new Error('Expected 1–100 valid dial rules');
  const keys = values.map(routeDialPatternKey);
  if (new Set(keys).size !== keys.length) throw new Error('Duplicate extension/Caller ID pair');
}
/** Asterisk ignores formatting hyphens outside character sets. */
export function routeDialPatternKey(value: string): string {
  return value.replace(/\[[^\]]*\]|-/g, token => token === '-' ? '' : token);
}
export function routeExecutionContext(routeUid: number, tenant: number): string {
  if (!Number.isSafeInteger(routeUid) || routeUid <= 0 || !Number.isSafeInteger(tenant) || tenant <= 0) throw new Error('Invalid route execution identity');
  return '__krs_route_' + routeUid + '_' + tenant;
}
