/**
 * Public PBX numbers vs tenant-scoped Asterisk ids.
 * Create/list MCP tools must speak 701 / 102, never q701_0 / e102_0.
 */

const QUEUE_ID = /^q(.+)_\d+$/i;
const SIP_ID = /^ew?(.+)_\d+$/i;

export function toPublicExten(raw: unknown, tenantUid?: number): string {
  const value = String(raw ?? '').trim();
  if (!value) return value;

  const queue = value.match(QUEUE_ID);
  if (queue) return queue[1];

  const sip = value.match(SIP_ID);
  if (sip) return sip[1];

  if (tenantUid != null) {
    const suffix = `_${tenantUid}`;
    if (value.endsWith(suffix)) {
      const base = value.slice(0, -suffix.length);
      if (/^\d{2,8}$/.test(base)) return base;
    }
  }

  return value;
}

export function isTenantTechnicalId(raw: unknown): boolean {
  const value = String(raw ?? '').trim();
  return QUEUE_ID.test(value) || SIP_ID.test(value);
}

/** PJSIP/e201_100 → PJSIP/201 so queue members are rebuilt for the dispatch tenant. */
export function toPublicMemberInterface(raw: unknown, tenantUid?: number): string {
  const value = String(raw ?? '').trim();
  if (!value) return value;
  if (/^Local\//i.test(value)) return value;
  const prefix = value.match(/^(PJSIP|SIP)\//i)?.[0];
  const id = prefix ? value.slice(prefix.length) : value;
  const pub = toPublicExten(id, tenantUid);
  if (!pub) return value;
  return prefix ? `PJSIP/${pub}` : pub;
}
