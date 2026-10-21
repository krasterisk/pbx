import { describe, expect, it } from 'vitest';
import { campaignCanStop, campaignPrimaryAction, orderCampaignsForSupervisor } from './campaignLifecycle';

describe('supervisor campaign lifecycle', () => {
  it('keeps a waiting current tour out of the new-tour action', () => {
    expect(campaignPrimaryAction('scheduled')).toBe('pause');
    expect(campaignCanStop('scheduled')).toBe(true);
    expect(campaignPrimaryAction('paused')).toBe('resume');
    expect(campaignPrimaryAction('completed')).toBe('start');
    expect(campaignCanStop('draft')).toBe(false);
  });
  it('shows an older working campaign before many newer drafts without changing the query data', () => {
    const drafts = Array.from({ length: 49 }, (_, i) => ({ uid: 100 + i, status: 'draft' as const }));
    const working = { uid: 20, status: 'scheduled' as const }, original = [...drafts, working];
    const sorted = orderCampaignsForSupervisor(original);
    expect(sorted[0]).toBe(working);
    expect(sorted[1].uid).toBe(148);
    expect(original[0]).toBe(drafts[0]);
  });
  it('keeps historical stopped and completed campaigns below current work', () => {
    expect(orderCampaignsForSupervisor([{ uid: 9, status: 'completed' }, { uid: 2, status: 'running' }, { uid: 7, status: 'paused' }, { uid: 5, status: 'stopped' }]).map(row => row.uid)).toEqual([2, 7, 5, 9]);
  });
});
