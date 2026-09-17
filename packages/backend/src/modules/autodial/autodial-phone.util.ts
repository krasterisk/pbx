import type { AutodialPhoneNormalization } from '@krasterisk/shared';

/** Normalize phone for dialing / DNC / dedup (mirrors directory-key.ru_8_to_7). */
export function normalizeAutodialPhone(
  value: string,
  mode: AutodialPhoneNormalization = 'ru_8_to_7',
): string {
  if (mode === 'none') return value.trim();
  const digits = value.replace(/[^0-9]/g, '');
  if (mode === 'ru_8_to_7' && /^8[0-9]{10}$/.test(digits)) {
    return `7${digits.slice(1)}`;
  }
  return digits;
}

/** Channel var name from field key: phone → AC_PHONE, full_name → AC_FULL_NAME */
export function fieldKeyToVarName(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
  return cleaned.startsWith('AC_') ? cleaned : `AC_${cleaned}`;
}

/** Deterministic ARI channel id: ac-{campaign}-{task}-{attempt} */
export function buildAutodialChannelId(
  campaignUid: number,
  taskUid: number,
  attemptNo: number,
): string {
  return `ac-${campaignUid}-${taskUid}-${attemptNo}`;
}

export function parseAutodialChannelId(
  channelId: string,
): { campaignUid: number; taskUid: number; attemptNo: number } | null {
  const m = /^ac-(\d+)-(\d+)-(\d+)$/.exec(channelId);
  if (!m) return null;
  return {
    campaignUid: Number(m[1]),
    taskUid: Number(m[2]),
    attemptNo: Number(m[3]),
  };
}
