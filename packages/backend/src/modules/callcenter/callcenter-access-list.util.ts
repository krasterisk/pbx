/**
 * Flexible access-list token matching for queues / operators.
 * Tokens may be short numbers ("201", "700"), SIP ids ("e201_0"),
 * interfaces ("PJSIP/e201_0"), or queue names ("q700_0").
 */
import { extractExtension, interfaceToExtension } from '../endpoints/endpoint-ids.util';

export function normalizeAccessToken(raw: unknown): string {
  if (raw == null) return '';
  let s = String(raw).trim();
  if (!s) return '';
  if (s.includes('/')) {
    s = interfaceToExtension(s);
  } else if (/^e(w)?.+_\d+$/i.test(s)) {
    s = extractExtension(s);
  } else {
    const q = s.match(/^q(.+)_\d+$/i);
    if (q) s = q[1];
  }
  return s.toLowerCase();
}

/** Build a set of normalized tokens from a JSON array (ignores non-strings). */
export function normalizeAccessTokenSet(raw: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    const n = normalizeAccessToken(item);
    if (n) out.add(n);
  }
  return out;
}

export function accessTokenMatches(haystack: Set<string>, candidate: string): boolean {
  const n = normalizeAccessToken(candidate);
  if (!n) return false;
  return haystack.has(n);
}

export function isUnrestrictedAccessList(tokens: Set<string> | number[] | Set<number> | null | undefined): boolean {
  if (tokens == null) return true;
  if (Array.isArray(tokens)) return tokens.length === 0;
  return tokens.size === 0;
}

/** Positive integer ids from a JSON array (numbers or numeric strings). */
export function parsePositiveIdList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    const n = typeof item === 'number' ? item : (typeof item === 'string' && /^\d+$/.test(item.trim()) ? Number(item.trim()) : NaN);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function hasOperatorUserIdsKey(blob: unknown): boolean {
  return Boolean(blob && typeof blob === 'object' && !Array.isArray(blob) && Object.prototype.hasOwnProperty.call(blob, 'operatorUserIds'));
}

/** True when a label is a SIP interface / tenant id / bare extension (not a person name). */
export function isRawOperatorDisplayName(
  name: string | null | undefined,
  exten?: string | null,
): boolean {
  const n = String(name || '').trim();
  if (!n) return true;
  if (/^(PJSIP|SIP)\//i.test(n)) return true;
  if (/^e(w)?.+_\d+$/i.test(n)) return true;
  if (/^q.+_\d+$/i.test(n)) return true;
  const ext = normalizeAccessToken(exten ?? '') || normalizeAccessToken(n);
  if (ext && n.toLowerCase() === ext) return true;
  return false;
}

/** Prefer a human name; fall back to normalized extension. */
export function operatorDisplayName(
  name: string | null | undefined,
  exten: string,
): string {
  const ext = normalizeAccessToken(exten) || String(exten || '').trim();
  if (!isRawOperatorDisplayName(name, ext)) return String(name).trim();
  return ext;
}

/** Prefer a human label when merging candidates; fall back to normalized extension. */
export function preferHumanOperatorName(
  current: string | null | undefined,
  incoming: string | null | undefined,
  exten: string,
): string {
  const key = normalizeAccessToken(exten) || String(exten || '').trim();
  if (!isRawOperatorDisplayName(incoming, key)) return String(incoming).trim();
  if (!isRawOperatorDisplayName(current, key)) return String(current).trim();
  return key;
}
