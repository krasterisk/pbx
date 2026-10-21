import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyCampaignDraft } from './campaignDraft';
import { campaignDraftSessionKey, readCampaignDraft, removeCampaignDraft, writeCampaignDraft, readCampaignWizard, writeCampaignWizard } from './campaignDraftSession';

describe('unfinished campaign drafts', () => {
  beforeEach(() => sessionStorage.clear());
  it('restores incomplete input and scopes it to tenant, actor and wizard', () => {
    const key = campaignDraftSessionKey(7, 4, 'create:new'), draft = { ...emptyCampaignDraft(), name: 'Not ready', base_uid: null };
    expect(writeCampaignDraft(key, draft)).toBe(true);
    expect(readCampaignDraft(key)).toEqual(draft);
    expect(readCampaignDraft(campaignDraftSessionKey(7, 5, 'create:new'))).toBeNull();
    removeCampaignDraft(key);
    expect(readCampaignDraft(key)).toBeNull();
  });
  it('rejects expired, corrupted and incompatible draft data', () => {
    const key = 'case';
    sessionStorage.setItem(key, '{'); expect(readCampaignDraft(key)).toBeNull();
    sessionStorage.setItem(key, JSON.stringify({ version: 1, at: Date.now() - 8 * 86400000, draft: emptyCampaignDraft() }));
    expect(readCampaignDraft(key)).toBeNull();
    sessionStorage.setItem(key, JSON.stringify({ version: 1, at: Date.now(), draft: { ...emptyCampaignDraft(), pacing: null } }));
    expect(readCampaignDraft(key)).toBeNull();
  });
  it('reports unavailable storage without losing the in-memory input', () => {
    const draft = emptyCampaignDraft(), storage = { setItem: vi.fn(() => { throw new Error('quota'); }) } as unknown as Storage;
    expect(writeCampaignDraft('case', draft, storage)).toBe(false);
    expect(draft).toEqual(emptyCampaignDraft());
  });
  it('restores the step and goal independently of the server payload and clears both when discarded', () => {
    writeCampaignWizard('case', 4, 'debt');
    expect(readCampaignWizard('case')).toEqual({ step: 4, goal: 'debt' });
    expect(readCampaignWizard('another-actor')).toEqual({ step: 0, goal: 'appointment' });
    sessionStorage.setItem('case:wizard', JSON.stringify({ version: 1, at: Date.now(), step: 99, goal: 'debt' }));
    expect(readCampaignWizard('case').step).toBe(0);
    writeCampaignWizard('case', 4, 'debt'); removeCampaignDraft('case');
    expect(readCampaignWizard('case')).toEqual({ step: 0, goal: 'appointment' });
  });
  it('maps the old seven-step wizard position to the five-step flow without discarding input', () => {
    writeCampaignDraft('case', { ...emptyCampaignDraft(), name: 'Keep me' });
    sessionStorage.setItem('case:wizard', JSON.stringify({ version: 1, at: Date.now(), step: 6, goal: 'debt' }));
    expect(readCampaignWizard('case')).toEqual({ step: 4, goal: 'debt' });
    expect(readCampaignDraft('case')?.name).toBe('Keep me');
  });
});
