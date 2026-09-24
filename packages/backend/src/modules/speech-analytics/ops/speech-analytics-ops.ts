import type { SaAlertConfig, SaDigestConfig, SaProjectConfigV1 } from '@krasterisk/shared';

export function isDigestDue(digest: SaDigestConfig, now: Date): boolean {
  if (!digest.enabled) return false;
  const hour = digest.sendHour ?? 9;
  if (now.getHours() !== hour) return false;
  if (digest.schedule === 'weekly' && now.getDay() !== (digest.weeklyDay ?? 1) % 7) return false;
  if (digest.schedule === 'monthly' && now.getDate() !== (digest.monthlyDay ?? 1)) return false;
  if (!digest.lastSentAt) return true;
  const last = new Date(digest.lastSentAt);
  return now.getTime() - last.getTime() > 20 * 60 * 60 * 1000;
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
