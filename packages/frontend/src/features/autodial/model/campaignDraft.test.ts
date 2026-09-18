import type { IAutodialCampaign, IAutodialSchedule } from "@krasterisk/shared";
import {
  campaignToDraft,
  draftToPayload,
  emptyCampaignDraft,
  hasCampaignErrors,
  validateCampaignDraft,
} from "./campaignDraft";

function draftWith(
  overrides: Partial<ReturnType<typeof emptyCampaignDraft>> = {},
) {
  return {
    ...emptyCampaignDraft(),
    name: "Продление подписки",
    base_uid: 7,
    trunk_pool: [{ trunk_id: "mts", caller_id: "74950000000" }],
    queue_names: ["sales"],
    ...overrides,
  };
}

describe("validateCampaignDraft", () => {
  it("accepts a fully configured progressive campaign", () => {
    expect(validateCampaignDraft(draftWith())).toEqual({});
    expect(hasCampaignErrors({})).toBe(false);
  });

  it("rejects a blank name and a missing base", () => {
    const errors = validateCampaignDraft(
      draftWith({ name: "   ", base_uid: null }),
    );
    expect(errors.name).toBe("required");
    expect(errors.base_uid).toBe("required");
  });

  it("demands a trunk before the campaign can be saved, not on start", () => {
    expect(
      validateCampaignDraft(draftWith({ trunk_pool: [] })).trunk_pool,
    ).toBe("required");
  });

  it("demands a queue for progressive and power, but not for agentless", () => {
    expect(
      validateCampaignDraft(draftWith({ queue_names: [] })).queue_names,
    ).toBe("required");
    expect(
      validateCampaignDraft(draftWith({ dial_mode: "power", queue_names: [] }))
        .queue_names,
    ).toBe("required");
    expect(
      validateCampaignDraft(
        draftWith({
          dial_mode: "agentless",
          queue_names: [],
          scenario_actions: [{ id: "a", type: "hangup" }] as never,
        }),
      ),
    ).toEqual({});
  });

  it("demands a scenario for agentless, since nobody is there to talk", () => {
    const errors = validateCampaignDraft(
      draftWith({
        dial_mode: "agentless",
        queue_names: [],
        scenario_actions: [],
      }),
    );
    expect(errors.scenario_actions).toBe("required");
  });

  it("rejects a campaign with no pacing provider", () => {
    const errors = validateCampaignDraft(
      draftWith({ pacing: { providers: [] } }),
    );
    expect(errors.pacing).toBe("required");
  });

  it("refuses predictive without a live agent count to over-dial against", () => {
    const errors = validateCampaignDraft(
      draftWith({
        dial_mode: "predictive",
        pacing: { providers: [{ type: "static", max_channels: 5 }] },
      }),
    );
    expect(errors.predictive).toBe("queueAgentsRequired");
  });

  it("accepts predictive backed by queue agents", () => {
    const base = emptyCampaignDraft();
    const errors = validateCampaignDraft(
      draftWith({
        dial_mode: "predictive",
        pacing: {
          providers: [{ type: "queue_agents", queue_names: ["sales"] }],
          predictive: base.pacing.predictive,
        },
      }),
    );
    expect(errors).toEqual({});
  });

  it("rejects an out-of-range abandon target", () => {
    const errors = validateCampaignDraft(
      draftWith({
        dial_mode: "predictive",
        pacing: {
          providers: [{ type: "queue_agents", queue_names: ["sales"] }],
          predictive: {
            target_abandon_pct: 45,
            max_over_dial: 2,
            min_samples: 20,
          },
        },
      }),
    );
    expect(errors.predictive).toBe("range");
  });
});

describe("draftToPayload", () => {
  it("preserves an explicit zero retry interval and drops only blanks", () => {
    const payload = draftToPayload(
      draftWith({
        retry: {
          max_attempts: 2,
          default_interval_sec: 600,
          intervals_sec: { busy: 300, no_answer: 0, failed: undefined },
        },
      }),
    );
    const retry = payload.retry as { intervals_sec: Record<string, number> };
    expect(retry.intervals_sec).toEqual({ busy: 300, no_answer: 0 });
  });

  it("trims the campaign name", () => {
    expect(draftToPayload(draftWith({ name: "  Опрос  " })).name).toBe("Опрос");
  });
});

describe("campaignToDraft", () => {
  const schedule: IAutodialSchedule = {
    uid: 5,
    campaign_uid: 1,
    kind: "weekly",
    weekday: 1,
    time_from: "09:00",
    time_to: "18:00",
    timezone: "Europe/Moscow",
    date_from: null,
    date_to: null,
    enabled: true,
  };

  it("strips server-only schedule ids so a copy does not clash", () => {
    const draft = campaignToDraft({
      ...(emptyCampaignDraft() as unknown as IAutodialCampaign),
      uid: 1,
      name: "X",
      base_uid: 3,
      status: "draft",
      schedules: [schedule],
    } as IAutodialCampaign & { schedules: IAutodialSchedule[] });

    expect(draft.schedules).toHaveLength(1);
    expect(draft.schedules[0]).not.toHaveProperty("uid");
    expect(draft.schedules[0]).not.toHaveProperty("campaign_uid");
    expect(draft.schedules[0].time_from).toBe("09:00");
  });

  it("falls back to defaults when the server sends an empty pacing block", () => {
    const draft = campaignToDraft({
      uid: 1,
      name: "X",
      base_uid: 3,
      status: "draft",
      dial_mode: "power",
      pacing: { providers: [] },
    } as unknown as IAutodialCampaign);

    expect(draft.pacing.providers).toHaveLength(1);
    expect(draft.dial_mode).toBe("power");
  });
});
