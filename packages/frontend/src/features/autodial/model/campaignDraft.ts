import {
  AUTODIAL_DISPOSITIONS,
  type AutodialDialMode,
  type AutodialDisposition,
  type CreateAutodialCampaignInput,
  type IAutodialAmdConfig,
  type IAutodialCampaign,
  type IAutodialCidPolicy,
  type IAutodialPacingConfig,
  type IAutodialRetryConfig,
  type IAutodialSchedule,
  type IAutodialTrunkPoolItem,
  type IRouteAction,
} from "@krasterisk/shared";

export type AutodialScheduleDraft = Omit<
  IAutodialSchedule,
  "uid" | "campaign_uid"
>;

export interface AutodialCampaignDraft {
  revision?: number;
  name: string;
  dial_mode: AutodialDialMode;
  base_uid: number | null;
  pacing: IAutodialPacingConfig;
  retry: IAutodialRetryConfig;
  trunk_pool: IAutodialTrunkPoolItem[];
  cid_policy: IAutodialCidPolicy;
  /** Snapshot of pacing queue_agents queues; not edited on the General tab. */
  queue_names: string[];
  scenario_actions: IRouteAction[];
  amd: IAutodialAmdConfig;
  success_min_sec: number;
  dial_timeout_sec: number;
  schedules: AutodialScheduleDraft[];
}

/** Retry intervals the form exposes; other dispositions fall back to the default. */
export const RETRY_INTERVAL_DISPOSITIONS: AutodialDisposition[] = [
  "no_answer",
  "busy",
  "congestion",
  "failed",
  "answered_short",
  "amd_machine",
  "voicemail",
];

export function emptyCampaignDraft(): AutodialCampaignDraft {
  return {
    name: "",
    dial_mode: "progressive",
    base_uid: null,
    pacing: {
      providers: [{ type: "static", max_channels: 2 }],
      power_ratio: 2,
      predictive: { target_abandon_pct: 3, max_over_dial: 2, min_samples: 20 },
    },
    retry: {
      max_attempts: 3,
      default_interval_sec: 3600,
      intervals_sec: { no_answer: 1800, busy: 600, congestion: 300 },
    },
    trunk_pool: [],
    // New campaigns keep Caller ID next to its trunk. `cid_policy` survives
    // only as a read-compatible contract for campaigns saved before that UI.
    cid_policy: { mode: "per_trunk" },
    queue_names: [],
    scenario_actions: [],
    amd: { enabled: false, on_machine: "hangup", message_prompt: null },
    success_min_sec: 20,
    dial_timeout_sec: 30,
    schedules: [],
  };
}

/** Unique queue names from the queue_agents capacity provider. */
export function queueNamesFromPacing(pacing: IAutodialPacingConfig): string[] {
  const names = new Set<string>();
  for (const provider of pacing.providers ?? []) {
    if (provider.type !== "queue_agents") continue;
    for (const name of provider.queue_names ?? []) {
      const trimmed = String(name ?? "").trim();
      if (trimmed) names.add(trimmed);
    }
  }
  return [...names];
}

/**
 * Old campaigns stored the operator pool on `queue_names` without a
 * queue_agents provider. Hydrate that provider so capacity is not lost when
 * the General-tab MultiSelect is removed.
 */
export function hydratePacingFromLegacyQueues(
  pacing: IAutodialPacingConfig,
  legacyQueues: string[],
): IAutodialPacingConfig {
  const hasAgentProvider = (pacing.providers ?? []).some(
    (provider) => provider.type === "queue_agents",
  );
  const queues = legacyQueues.map((name) => name.trim()).filter(Boolean);
  if (hasAgentProvider || !queues.length) return pacing;
  return {
    ...pacing,
    providers: [
      ...pacing.providers,
      { type: "queue_agents", queue_names: queues },
    ],
  };
}

function scenarioHasFixedQueue(actions: IRouteAction[]): boolean {
  return actions.some((action) => {
    if (!action || (action as { enabled?: boolean }).enabled === false) {
      return false;
    }
    if (action.type !== "toqueue") return false;
    const params = (action.params ?? {}) as Record<string, unknown>;
    const target = params.target as { source?: unknown; value?: unknown } | undefined;
    return Boolean(
      String(params.queue ?? params.queue_name ?? "").trim()
      || (target?.source === "fixed" && String(target.value ?? "").trim()),
    );
  });
}

export function campaignToDraft(
  campaign: IAutodialCampaign & { schedules?: IAutodialSchedule[] },
): AutodialCampaignDraft {
  const base = emptyCampaignDraft();
  const pacing = campaign.pacing?.providers?.length
    ? {
        ...campaign.pacing,
        predictive: campaign.pacing.predictive ?? base.pacing.predictive,
      }
    : base.pacing;
  const legacyQueues = campaign.queue_names ?? [];
  const hydrated = hydratePacingFromLegacyQueues(pacing, legacyQueues);

  return {
    revision: campaign.revision,
    name: campaign.name,
    dial_mode: campaign.dial_mode,
    base_uid: campaign.base_uid,
    pacing: hydrated,
    retry: campaign.retry ?? base.retry,
    trunk_pool: campaign.trunk_pool ?? [],
    cid_policy: campaign.cid_policy ?? base.cid_policy,
    queue_names: queueNamesFromPacing(hydrated),
    scenario_actions: campaign.scenario_actions ?? [],
    amd: campaign.amd
      ? {
          enabled: campaign.amd.enabled,
          on_machine: campaign.amd.on_machine,
          message_prompt: campaign.amd.message_prompt ?? null,
        }
      : base.amd,
    success_min_sec: campaign.success_min_sec ?? base.success_min_sec,
    dial_timeout_sec: campaign.dial_timeout_sec ?? base.dial_timeout_sec,
    schedules: (campaign.schedules ?? []).map(
      ({ uid: _uid, campaign_uid: _cid, ...rest }) => rest,
    ),
  };
}

export interface CampaignDraftErrors {
  name?: string;
  base_uid?: string;
  trunk_pool?: string;
  pacing?: string;
  predictive?: string;
  scenario_actions?: string;
  amd?: string;
}

/**
 * Mirrors what the backend rejects, so the operator sees the problem before a
 * round trip. `AC_NO_TRUNK` in particular only surfaces on start, which is far
 * too late to be useful.
 */
export function validateCampaignDraft(
  draft: AutodialCampaignDraft,
): CampaignDraftErrors {
  const errors: CampaignDraftErrors = {};

  if (!draft.name.trim()) errors.name = "required";
  if (!draft.base_uid) errors.base_uid = "required";
  if (draft.trunk_pool.length === 0) errors.trunk_pool = "required";
  if (draft.pacing.providers.length === 0) errors.pacing = "required";

  // Progressive and Power hand the answered call to a queue step in the
  // scenario. Capacity queues live only under the pacing provider.
  if (draft.dial_mode !== "agentless" && !scenarioHasFixedQueue(draft.scenario_actions)) {
    errors.scenario_actions = "queueRequired";
  }
  if (draft.dial_mode === "agentless" && draft.scenario_actions.length === 0) {
    errors.scenario_actions = "required";
  }

  if (
    draft.amd.enabled
    && draft.amd.on_machine === "voicemail"
    && !String(draft.amd.message_prompt ?? "").trim()
  ) {
    errors.amd = "messageRequired";
  }

  // Predictive over-dials on purpose, so it needs a live agent count to over-dial
  // against and a sane abandon target to steer by.
  if (draft.dial_mode === "predictive") {
    const predictive = draft.pacing.predictive;
    const hasAgentProvider = draft.pacing.providers.some(
      (p) => p.type === "queue_agents",
    );
    if (!hasAgentProvider) {
      errors.predictive = "queueAgentsRequired";
    } else if (
      !predictive ||
      predictive.target_abandon_pct < 0 ||
      predictive.target_abandon_pct > 20 ||
      predictive.max_over_dial < 1 ||
      predictive.max_over_dial > 5
    ) {
      errors.predictive = "range";
    }
  }

  return errors;
}

export function hasCampaignErrors(errors: CampaignDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Strip empty retry intervals so the API stores only what was set. */
export function draftToPayload(
  draft: AutodialCampaignDraft,
): CreateAutodialCampaignInput {
  if (!draft.base_uid) throw new Error("Campaign base is required");
  const intervals: Partial<Record<AutodialDisposition, number>> = {};
  for (const disposition of AUTODIAL_DISPOSITIONS) {
    const value = draft.retry.intervals_sec[disposition];
    // `0` is an intentional value: retry at the next pacer tick. Only an
    // omitted value inherits the default interval.
    if (typeof value === "number" && value >= 0) intervals[disposition] = value;
  }

  return {
    name: draft.name.trim(),
    dial_mode: draft.dial_mode,
    base_uid: draft.base_uid,
    pacing: draft.pacing,
    retry: { ...draft.retry, intervals_sec: intervals },
    trunk_pool: draft.trunk_pool,
    cid_policy: draft.cid_policy,
    queue_names: queueNamesFromPacing(draft.pacing),
    scenario_actions: draft.scenario_actions,
    amd: draft.amd,
    success_min_sec: draft.success_min_sec,
    dial_timeout_sec: draft.dial_timeout_sec,
    schedules: draft.schedules,
  };
}
