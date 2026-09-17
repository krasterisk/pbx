import {
  AUTODIAL_DISPOSITIONS,
  type AutodialDialMode,
  type AutodialDisposition,
  type IAutodialAmdConfig,
  type IAutodialCampaign,
  type IAutodialCidPolicy,
  type IAutodialPacingConfig,
  type IAutodialRetryConfig,
  type IAutodialSchedule,
  type IAutodialTrunkPoolItem,
  type IRouteAction,
} from '@krasterisk/shared';

export type AutodialScheduleDraft = Omit<IAutodialSchedule, 'uid' | 'campaign_uid'>;

export interface AutodialCampaignDraft {
  name: string;
  dial_mode: AutodialDialMode;
  base_uid: number | null;
  pacing: IAutodialPacingConfig;
  retry: IAutodialRetryConfig;
  trunk_pool: IAutodialTrunkPoolItem[];
  cid_policy: IAutodialCidPolicy;
  queue_names: string[];
  scenario_actions: IRouteAction[];
  amd: IAutodialAmdConfig;
  success_min_sec: number;
  dial_timeout_sec: number;
  schedules: AutodialScheduleDraft[];
}

/** Retry intervals the form exposes; other dispositions fall back to the default. */
export const RETRY_INTERVAL_DISPOSITIONS: AutodialDisposition[] = [
  'no_answer',
  'busy',
  'congestion',
  'failed',
  'answered_short',
  'amd_machine',
  'voicemail',
];

export function emptyCampaignDraft(): AutodialCampaignDraft {
  return {
    name: '',
    dial_mode: 'progressive',
    base_uid: null,
    pacing: {
      providers: [{ type: 'static', max_channels: 2 }],
      power_ratio: 2,
      predictive: { target_abandon_pct: 3, max_over_dial: 2, min_samples: 20 },
    },
    retry: {
      max_attempts: 3,
      default_interval_sec: 3600,
      intervals_sec: { no_answer: 1800, busy: 600, congestion: 300 },
    },
    trunk_pool: [],
    cid_policy: { mode: 'static', value: '' },
    queue_names: [],
    scenario_actions: [],
    amd: { enabled: false, on_machine: 'hangup' },
    success_min_sec: 20,
    dial_timeout_sec: 30,
    schedules: [],
  };
}

export function campaignToDraft(
  campaign: IAutodialCampaign & { schedules?: IAutodialSchedule[] },
): AutodialCampaignDraft {
  const base = emptyCampaignDraft();
  return {
    name: campaign.name,
    dial_mode: campaign.dial_mode,
    base_uid: campaign.base_uid,
    pacing: campaign.pacing?.providers?.length
      ? { ...campaign.pacing, predictive: campaign.pacing.predictive ?? base.pacing.predictive }
      : base.pacing,
    retry: campaign.retry ?? base.retry,
    trunk_pool: campaign.trunk_pool ?? [],
    cid_policy: campaign.cid_policy ?? base.cid_policy,
    queue_names: campaign.queue_names ?? [],
    scenario_actions: campaign.scenario_actions ?? [],
    amd: campaign.amd ?? base.amd,
    success_min_sec: campaign.success_min_sec ?? base.success_min_sec,
    dial_timeout_sec: campaign.dial_timeout_sec ?? base.dial_timeout_sec,
    schedules: (campaign.schedules ?? []).map(({ uid: _uid, campaign_uid: _cid, ...rest }) => rest),
  };
}

export interface CampaignDraftErrors {
  name?: string;
  base_uid?: string;
  trunk_pool?: string;
  queue_names?: string;
  pacing?: string;
  predictive?: string;
  scenario_actions?: string;
}

/**
 * Mirrors what the backend rejects, so the operator sees the problem before a
 * round trip. `AC_NO_TRUNK` in particular only surfaces on start, which is far
 * too late to be useful.
 */
export function validateCampaignDraft(draft: AutodialCampaignDraft): CampaignDraftErrors {
  const errors: CampaignDraftErrors = {};

  if (!draft.name.trim()) errors.name = 'required';
  if (!draft.base_uid) errors.base_uid = 'required';
  if (draft.trunk_pool.length === 0) errors.trunk_pool = 'required';
  if (draft.pacing.providers.length === 0) errors.pacing = 'required';

  // Progressive and Power hand the answered call to a queue; without one the
  // caller would reach a dead context.
  if (draft.dial_mode !== 'agentless' && draft.queue_names.length === 0) {
    errors.queue_names = 'required';
  }
  if (draft.dial_mode === 'agentless' && draft.scenario_actions.length === 0) {
    errors.scenario_actions = 'required';
  }

  // Predictive over-dials on purpose, so it needs a live agent count to over-dial
  // against and a sane abandon target to steer by.
  if (draft.dial_mode === 'predictive') {
    const predictive = draft.pacing.predictive;
    const hasAgentProvider = draft.pacing.providers.some((p) => p.type === 'queue_agents');
    if (!hasAgentProvider) {
      errors.predictive = 'queueAgentsRequired';
    } else if (
      !predictive
      || predictive.target_abandon_pct < 0
      || predictive.target_abandon_pct > 20
      || predictive.max_over_dial < 1
      || predictive.max_over_dial > 5
    ) {
      errors.predictive = 'range';
    }
  }

  return errors;
}

export function hasCampaignErrors(errors: CampaignDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Strip empty retry intervals so the API stores only what was set. */
export function draftToPayload(draft: AutodialCampaignDraft): Record<string, unknown> {
  const intervals: Partial<Record<AutodialDisposition, number>> = {};
  for (const disposition of AUTODIAL_DISPOSITIONS) {
    const value = draft.retry.intervals_sec[disposition];
    if (typeof value === 'number' && value > 0) intervals[disposition] = value;
  }

  return {
    name: draft.name.trim(),
    dial_mode: draft.dial_mode,
    base_uid: draft.base_uid,
    pacing: draft.pacing,
    retry: { ...draft.retry, intervals_sec: intervals },
    trunk_pool: draft.trunk_pool,
    cid_policy: draft.cid_policy,
    queue_names: draft.queue_names,
    scenario_actions: draft.scenario_actions,
    amd: draft.amd,
    success_min_sec: draft.success_min_sec,
    dial_timeout_sec: draft.dial_timeout_sec,
    schedules: draft.schedules,
  };
}
