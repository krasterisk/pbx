import type { SaNotice, SaNoticeWindow } from '@krasterisk/shared';
import type { DashboardAggregate } from '../dashboard/dashboard.service';
import { detectCsatDrop } from '../ops/speech-analytics-ops';

export function noticeWindow(window: SaNoticeWindow | undefined, now: Date): { from: Date; to: Date; label: string } {
  if (window === 'last_30_days') {
    return { from: new Date(now.getTime() - 30 * 86400000), to: now, label: 'Последние 30 дней' };
  }
  if (window === 'previous_calendar_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to, label: 'Прошлый календарный месяц' };
  }
  return { from: new Date(now.getTime() - 7 * 86400000), to: now, label: 'Последние 7 дней' };
}

function cooledDown(notice: SaNotice, now: Date): boolean {
  if (!notice.lastFiredAt) return true;
  const days = Math.max(1, notice.windowDays ?? 1);
  const last = new Date(notice.lastFiredAt).getTime();
  return now.getTime() - last > days * 86400000;
}

export function alertDetail(
  notice: SaNotice,
  recent: DashboardAggregate,
  previous: DashboardAggregate | null,
  spent: number,
  softLimit: number,
  now: Date,
): string | null {
  if (!notice.enabled || !cooledDown(notice, now)) return null;
  if (notice.kind === 'csat_drop') {
    const fired = detectCsatDrop(
      {
        enabled: true,
        integrationUids: [],
        inheritRecipientsFromDigest: true,
        emails: [],
        telegramChatIds: [],
        csatDrop: {
          enabled: true,
          dropPct: notice.dropPct ?? 20,
          windowDays: notice.windowDays ?? 7,
          minCalls: notice.minCalls ?? 5,
        },
        negativeSpike: { enabled: false, spikePp: 0, windowDays: 7, minCalls: 5 },
        budgetExceeded: { enabled: false },
      },
      recent.averageScore,
      previous?.averageScore ?? null,
      recent.conversationCount,
    );
    if (!fired) return null;
    return `Средняя оценка ${recent.averageScore?.toFixed(1) ?? '-'} против ${previous?.averageScore?.toFixed(1) ?? '-'}.`;
  }
  if (notice.kind === 'negative_spike') {
    const recentTotal = recent.sentiment.positive + recent.sentiment.neutral + recent.sentiment.negative;
    const previousTotal = previous
      ? previous.sentiment.positive + previous.sentiment.neutral + previous.sentiment.negative
      : 0;
    if (recent.conversationCount < (notice.minCalls ?? 5) || recentTotal === 0 || previousTotal === 0) return null;
    const recentPct = (recent.sentiment.negative / recentTotal) * 100;
    const previousPct = (previous!.sentiment.negative / previousTotal) * 100;
    if (recentPct - previousPct < (notice.spikePp ?? 15)) return null;
    return `Негатив ${Math.round(recentPct)}% против ${Math.round(previousPct)}%.`;
  }
  if (notice.kind === 'budget') {
    if (softLimit <= 0 || spent < softLimit) return null;
    return `Потрачено ${spent.toFixed(2)} при пороге ${softLimit}.`;
  }
  if (notice.kind === 'low_stt') {
    if (recent.conversationCount < (notice.minCalls ?? 5)) return null;
    const share = (recent.lowSttCount / recent.conversationCount) * 100;
    if (share < (notice.lowSttPct ?? 30)) return null;
    return `Плохое распознавание в ${Math.round(share)}% звонков.`;
  }
  return null;
}
