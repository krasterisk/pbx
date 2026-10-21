import type { AutodialCampaignStatus } from '@krasterisk/shared';

/** A calendar wait is part of the current tour; Pause makes it manual. */
export function campaignPrimaryAction(status: AutodialCampaignStatus): 'pause' | 'resume' | 'start' {
  if (status === 'running' || status === 'scheduled') return 'pause';
  return status === 'paused' ? 'resume' : 'start';
}
export function campaignCanStop(status: AutodialCampaignStatus): boolean {
  return ['running', 'paused', 'scheduled'].includes(status);
}
export function orderCampaignsForSupervisor<T extends { uid: number; status: AutodialCampaignStatus }>(rows: readonly T[]): T[] {
  const rank: Record<AutodialCampaignStatus, number> = { running: 0, paused: 1, scheduled: 2, draft: 3, stopped: 4, completed: 5 };
  return [...rows].sort((a, b) => (rank[a.status] ?? 6) - (rank[b.status] ?? 6) || b.uid - a.uid);
}
