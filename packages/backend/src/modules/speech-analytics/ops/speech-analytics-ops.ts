import { digestSchedules, type SaAlertConfig, type SaDigestConfig, type SaDigestSchedule, type SaProjectConfigV1 } from '@krasterisk/shared';

function scheduleIsDue(slot: SaDigestSchedule, now: Date): boolean {
  const hour = slot.sendHour ?? 9;
  if (now.getHours() !== hour) return false;
  if (slot.schedule === 'weekly' && now.getDay() !== (slot.weeklyDay ?? 1) % 7) return false;
  if (slot.schedule === 'monthly' && now.getDate() !== (slot.monthlyDay ?? 1)) return false;
  if (!slot.lastSentAt) return true;
  const last = new Date(slot.lastSentAt);
  return now.getTime() - last.getTime() > 20 * 60 * 60 * 1000;
}

/** Rules that should send at `now`. Each rule keeps its own lastSentAt. */
export function dueDigestSchedules(digest: SaDigestConfig, now: Date): SaDigestSchedule[] {
  if (!digest.enabled && !(digest.schedules ?? []).length) return [];
  return digestSchedules(digest).filter((slot) => scheduleIsDue(slot, now));
}

/** True when any saved rule should send now. */
export function isDigestDue(digest: SaDigestConfig, now: Date): boolean {
  return dueDigestSchedules(digest, now).length > 0;
}

export function detectCsatDrop(
  alerts: SaAlertConfig,
  recentAvg: number | null,
  baselineAvg: number | null,
  recentCalls: number,
): boolean {
  if (!alerts.enabled || !alerts.csatDrop.enabled) return false;
  if (recentAvg == null || baselineAvg == null || baselineAvg <= 0) return false;
  if (recentCalls < alerts.csatDrop.minCalls) return false;
  const dropPct = ((baselineAvg - recentAvg) / baselineAvg) * 100;
  return dropPct >= alerts.csatDrop.dropPct;
}

export function stuckBefore(now: Date, minutes: number): Date {
  return new Date(now.getTime() - Math.max(1, minutes) * 60 * 1000);
}

export function analysisAllowed(balance: number | null): boolean {
  if (balance == null) return true;
  return balance > 0;
}

export function projectAlerts(config: SaProjectConfigV1): SaAlertConfig {
  return config.alerts;
}
