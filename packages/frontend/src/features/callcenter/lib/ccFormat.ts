import type { TranslateFn } from '@/shared/lib/translateFn';
import type { CallStatus } from '../model/types/callCenterSchema';

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] as const;
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Unified duration formatter for all Call Center screens (U0.1):
 * `< 1h` -> `m:ss` (`0:00`, `0:59`, `59:59`), `>= 1h` -> `h:mm:ss` (`1:00:00`).
 */
export function formatCcDuration(totalSec: number | null | undefined): string {
  const sec = typeof totalSec === 'number' && Number.isFinite(totalSec) && totalSec > 0
    ? Math.floor(totalSec)
    : 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * Unified percentage formatter (U0.1): rounded to at most 1 decimal place.
 * Russian uses comma + space (`78,4 %`), English uses dot (`78.4%`).
 */
export function formatCcPercent(
  value: number | null | undefined,
  locale: 'ru' | 'en' = 'ru',
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  if (locale === 'en') return `${rounded}%`;
  return `${String(rounded).replace('.', ',')} %`;
}

interface ParsedIsoDate {
  year: number;
  monthIdx: number;
  day: number;
}

function parseIsoDate(iso: string): ParsedIsoDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (!Number.isFinite(year) || monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return null;
  return { year, monthIdx, day };
}

function formatDayMonth(d: ParsedIsoDate, locale: 'ru' | 'en'): string {
  return locale === 'en'
    ? `${MONTHS_EN[d.monthIdx]} ${d.day}`
    : `${d.day} ${MONTHS_RU[d.monthIdx]}`;
}

function formatFullDate(d: ParsedIsoDate, locale: 'ru' | 'en'): string {
  return locale === 'en'
    ? `${MONTHS_EN[d.monthIdx]} ${d.day}, ${d.year}`
    : `${d.day} ${MONTHS_RU[d.monthIdx]} ${d.year}`;
}

/**
 * Localized date range (`20 июл — 19 авг 2026` / `Jul 20 — Aug 19, 2026`).
 */
export function formatCcDateRange(
  fromIso: string,
  toIso: string,
  locale: 'ru' | 'en' = 'ru',
): string {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) {
    return fromIso === toIso ? fromIso : `${fromIso} — ${toIso}`;
  }
  if (fromIso === toIso) {
    return formatFullDate(from, locale);
  }
  if (from.year === to.year) {
    return locale === 'en'
      ? `${formatDayMonth(from, 'en')} — ${formatDayMonth(to, 'en')}, ${to.year}`
      : `${formatDayMonth(from, 'ru')} — ${formatDayMonth(to, 'ru')} ${to.year}`;
  }
  return `${formatFullDate(from, locale)} — ${formatFullDate(to, locale)}`;
}

/**
 * Human-readable phone number (`+7 912 345-67-89`) while keeping short internal extensions intact.
 */
export function formatPhone(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '-';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    const body = digits.slice(1);
    return `+7 ${body.slice(0, 3)} ${body.slice(3, 6)}-${body.slice(6, 8)}-${body.slice(8, 10)}`;
  }
  return trimmed;
}

export const CALL_STATUS_LABEL_KEYS: Record<CallStatus, { key: string; fallback: string }> = {
  WAITING: { key: 'callcenter.callStatus.waiting', fallback: 'Waiting' },
  RINGING: { key: 'callcenter.callStatus.ringing', fallback: 'Ringing agent' },
  TALKING: { key: 'callcenter.callStatus.talking', fallback: 'In call' },
  HOLD: { key: 'callcenter.callStatus.hold', fallback: 'On hold' },
  TRANSFERRED: { key: 'callcenter.callStatus.transferred', fallback: 'Transferred' },
};

/**
 * Localized label for a live call status (replaces raw `WAITING` / `TALKING` strings in UI).
 */
export function callStatusLabel(
  status: CallStatus | string,
  t: TranslateFn,
): string {
  const entry = CALL_STATUS_LABEL_KEYS[status as CallStatus];
  if (!entry) return status || '-';
  return t(entry.key, entry.fallback);
}
