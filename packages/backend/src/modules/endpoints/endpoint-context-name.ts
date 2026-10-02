/**
 * Dialplan context names from the contexts catalog already include the tenant
 * id as a hyphen segment (`ctx-362`, `ctx-362-ext`). Legacy endpoints glued the
 * id on with no separator (`from-internal` + `362` → `from-internal362`).
 * Only the glued form may be stripped for display or skipped when appending.
 */

function isLegacyGluedSuffix(context: string, suffix: string): boolean {
  if (!suffix || context.length <= suffix.length || !context.endsWith(suffix)) return false;
  const boundary = context.charAt(context.length - suffix.length - 1);
  return boundary !== '-' && !/\d/.test(boundary);
}

function alreadyScoped(context: string, suffix: string): boolean {
  if (context.split('-').includes(suffix)) return true;
  return isLegacyGluedSuffix(context, suffix);
}

export function buildEndpointContext(context: string | null | undefined, tenantId: number): string {
  const suffix = String(tenantId);
  const base = (context ?? '').trim();
  if (!base) return `from-internal${suffix}`;
  if (alreadyScoped(base, suffix)) return base;
  return `${base}${suffix}`;
}

export function stripEndpointContext(context: string | null | undefined, tenantId: number): string {
  if (!context) return '';
  const suffix = String(tenantId);
  if (!isLegacyGluedSuffix(context, suffix)) return context;
  return context.slice(0, -suffix.length);
}
