import {
  CALLERID_PHONE_RE,
  evaluateCallerIdName,
  type DialTargetRewrite,
} from '@krasterisk/shared';
import type { NumbersService } from '../numbers/numbers.service';

export interface CallerIdNameRequest {
  value?: string;
  rewrite?: string;
  api_key?: string;
  vpbx_user_uid?: string;
}
export interface CallerIdListRequest {
  list_uid?: string;
  pick?: string;
  key?: string;
  api_key?: string;
  vpbx_user_uid?: string;
}
const found = (value: string) => 'KCID2|FOUND|' + Buffer.from(value, 'utf8').toString('base64');
export function callerIdNameResponse(body: CallerIdNameRequest): string {
  try {
    if (
      typeof body.value !== 'string' ||
      typeof body.rewrite !== 'string' ||
      body.rewrite.length > 32768
    )
      return 'KCID2|ERROR|';
    const rewrite = JSON.parse(
      Buffer.from(body.rewrite, 'base64').toString('utf8'),
    ) as DialTargetRewrite;
    const result = evaluateCallerIdName(body.value, rewrite);
    return result.error ? 'KCID2|ERROR|' : found(result.output);
  } catch {
    return 'KCID2|ERROR|';
  }
}
function readNumbers(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const map = raw as Record<string, unknown>;
    if (Array.isArray(map.numbers)) return map.numbers;
    return Object.entries(map).map(([from, to]) => ({ from, to }));
  }
  return [];
}
export async function callerIdListResponse(
  numbers: NumbersService,
  body: CallerIdListRequest,
): Promise<string> {
  try {
    const listUid = Number(body.list_uid);
    const tenant = Number(body.vpbx_user_uid);
    if (
      !Number.isSafeInteger(listUid) ||
      listUid <= 0 ||
      !Number.isSafeInteger(tenant) ||
      tenant < 0 ||
      !['mapping', 'first', 'random', 'round_robin'].includes(body.pick ?? '')
    )
      return 'KCID2|ERROR|';
    const list = await numbers.findById(listUid, tenant);
    if (!list) return 'KCID2|NOT_FOUND|';
    const entries = readNumbers(list.numbers);
    const phones = entries.map((item) =>
      typeof item === 'string'
        ? item
        : item && typeof item === 'object'
          ? String((item as { to?: unknown }).to ?? '')
          : '',
    );
    const pool = Array.from(new Set(phones.filter((phone) => CALLERID_PHONE_RE.test(phone))));
    if (!pool.length) return 'KCID2|NOT_FOUND|';
    if (pool.length > 100) return 'KCID2|ERROR|';
    if (body.pick === 'random' || body.pick === 'round_robin') return found(pool.join('|'));
    if (body.pick === 'first') return found(pool[0]);
    const mapped = entries.find((item) =>
      typeof item === 'string'
        ? item === body.key
        : item &&
          typeof item === 'object' &&
          String((item as { from?: unknown }).from ?? '') === (body.key ?? ''),
    );
    const selected =
      typeof mapped === 'string'
        ? mapped
        : mapped
          ? String((mapped as { to?: unknown }).to ?? '')
          : undefined;
    return typeof selected === 'string' && CALLERID_PHONE_RE.test(selected)
      ? found(selected)
      : 'KCID2|NOT_FOUND|';
  } catch {
    return 'KCID2|ERROR|';
  }
}
