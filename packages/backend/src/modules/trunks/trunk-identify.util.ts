/** Split matchIp / host into Asterisk `ps_endpoint_id_ips.match` values. */
export function parseIdentifyMatches(raw?: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const match = normalizeIdentifyMatch(part);
    if (!match || seen.has(match)) continue;
    seen.add(match);
    out.push(match);
  }
  return out;
}

export function normalizeIdentifyMatch(value: string): string {
  let v = value.trim().replace(/^sip:/i, '');
  if (!v) return '';

  if (v.startsWith('[')) {
    const end = v.indexOf(']');
    return end === -1 ? v : v.slice(1, end);
  }

  if (v.includes('/')) return v;

  const hostPort = v.match(/^([\w.-]+):(\d+)$/);
  if (hostPort) return hostPort[1];

  return v;
}

export function identifyNeedsSrvLookup(match: string): boolean {
  return /[a-zA-Z]/.test(match);
}

export function identifyRowId(trunkId: string, index: number): string {
  const suffix = index === 0 ? '_identify' : `_identify_${index}`;
  const id = `${trunkId}${suffix}`;
  return id.length <= 40 ? id : `${trunkId.slice(0, 40 - suffix.length)}${suffix}`;
}
