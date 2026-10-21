import { emptyCampaignDraft, type AutodialCampaignDraft } from './campaignDraft';
import { AUTODIAL_BUSINESS_GOALS, type AutodialBusinessGoal } from '@krasterisk/shared';

const MAX_AGE = 7 * 86400000;
export function campaignDraftSessionKey(tenant: number, actor: number, session: string) {
  return `autodial:draft:v1:${tenant}:${actor}:${session}`;
}
export function readCampaignDraft(key: string | null, storage?: Storage): AutodialCampaignDraft | null {
  if (!key) return null;
  try {
    const json = (storage ?? sessionStorage).getItem(key);
    if (!json || json.length > 2_000_000) return null;
    const saved = JSON.parse(json), draft = saved?.draft;
    if (saved.version !== 1 || !Number.isFinite(saved.at) || Date.now() - saved.at > MAX_AGE || saved.at > Date.now() + 60000 || !draft) return null;
    if (draft.business_goal === undefined) {
      draft.business_goal = 'custom';
      try {
        const view = JSON.parse((storage ?? sessionStorage).getItem(`${key}:wizard`) ?? 'null');
        if (view && AUTODIAL_BUSINESS_GOALS.includes(view.goal)) draft.business_goal = view.goal;
      } catch { /* A broken view preference must not erase a valid draft. */ }
    }
    const empty = emptyCampaignDraft();
    if (!Object.keys(empty).every((name) => Array.isArray(empty[name as keyof typeof empty])
      ? Array.isArray(draft[name]) : name === 'base_uid' ? draft[name] === null || Number.isInteger(draft[name])
        : typeof draft[name] === typeof empty[name as keyof typeof empty])) return null;
    if (!AUTODIAL_BUSINESS_GOALS.includes(draft.business_goal) || !draft.pacing || !draft.retry || !draft.amd || !draft.cid_policy || !Array.isArray(draft.pacing.providers) || !draft.retry.intervals_sec || !['agentless', 'progressive', 'power', 'predictive'].includes(draft.dial_mode)) return null;
    return draft;
  } catch { return null; }
}
export function writeCampaignDraft(key: string | null, draft: AutodialCampaignDraft, storage?: Storage): boolean {
  if (!key) return false;
  try { (storage ?? sessionStorage).setItem(key, JSON.stringify({ version: 1, at: Date.now(), draft })); return true; } catch { return false; }
}
export function removeCampaignDraft(key: string | null, storage?: Storage) {
  if (key) try { (storage ?? sessionStorage).removeItem(key); (storage ?? sessionStorage).removeItem(`${key}:wizard`); } catch { /* Storage can be disabled. */ }
}

/** View state stays outside the server DTO and the preflight fingerprint. */
export function readCampaignWizard(key: string | null): { step: number; goal: AutodialBusinessGoal } {
  const fallback = { step: 0, goal: 'appointment' as const };
  if (!key) return fallback;
  try {
    const saved = JSON.parse(sessionStorage.getItem(`${key}:wizard`) ?? 'null');
    if (!saved || ![1, 2].includes(saved.version) || !Number.isFinite(saved.at) || Date.now() - saved.at > MAX_AGE || saved.at > Date.now() + 60000
      || !Number.isInteger(saved.step) || saved.step < 0 || saved.step > (saved.version === 1 ? 6 : 4)
      || !AUTODIAL_BUSINESS_GOALS.includes(saved.goal)) return fallback;
    return { step: saved.version === 1 ? [1, 2, 2, 3, 3, 3, 4][saved.step] : saved.step, goal: saved.goal };
  } catch { return fallback; }
}
export function writeCampaignWizard(key: string | null, step: number, goal: AutodialBusinessGoal) {
  if (key) try { sessionStorage.setItem(`${key}:wizard`, JSON.stringify({ version: 2, at: Date.now(), step, goal })); } catch { /* The form remains usable without storage. */ }
}
