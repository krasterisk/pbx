import type { AutodialCampaignStatus, AutodialDisposition } from '@krasterisk/shared';

export interface AutodialLiveChannel {
  channelId: string;
  campaignUid: number;
  taskUid: number;
  attemptUid: number;
  attemptNo: number;
  number: string;
  trunkId: string;
  startedAt: number;
  answeredAt: number | null;
}

export interface AutodialCampaignRuntime {
  campaignUid: number;
  status: AutodialCampaignStatus;
  capacity: number;
  limitedBy: string;
  reserved: number;
  dials: number;
  answered: number;
  success: number;
  /** Predictive only: live over-dial multiplier and the abandon rate behind it */
  overDial?: number;
  abandonPct?: number;
}

/** Mirror of AutodialSseEvent from the backend state service. */
export type AutodialSseEvent =
  | { type: 'snapshot'; campaigns: AutodialCampaignRuntime[]; channels: AutodialLiveChannel[] }
  | { type: 'channel_started'; channel: AutodialLiveChannel }
  | { type: 'channel_answered'; channelId: string; campaignUid: number }
  | {
      type: 'channel_ended';
      channelId: string;
      campaignUid: number;
      disposition: AutodialDisposition;
    }
  | { type: 'campaign_stats'; runtime: AutodialCampaignRuntime }
  | {
      type: 'pacer';
      campaignUid: number;
      capacity: number;
      limitedBy: string;
      reserved: number;
      overDial?: number;
      abandonPct?: number;
    };

export interface AutodialLiveState {
  runtimes: Record<number, AutodialCampaignRuntime>;
  channels: AutodialLiveChannel[];
}

export const emptyAutodialLiveState: AutodialLiveState = { runtimes: {}, channels: [] };

function blankRuntime(campaignUid: number): AutodialCampaignRuntime {
  return {
    campaignUid,
    status: 'running',
    capacity: 0,
    limitedBy: 'none',
    reserved: 0,
    dials: 0,
    answered: 0,
    success: 0,
  };
}

function patchRuntime(
  state: AutodialLiveState,
  campaignUid: number,
  patch: (runtime: AutodialCampaignRuntime) => AutodialCampaignRuntime,
): Record<number, AutodialCampaignRuntime> {
  const current = state.runtimes[campaignUid] ?? blankRuntime(campaignUid);
  return { ...state.runtimes, [campaignUid]: patch(current) };
}

/**
 * Folds one SSE frame into the live view. The counters the dialer sends are
 * per-event deltas, so this has to accumulate rather than replace — except for
 * `snapshot` and `campaign_stats`, which are authoritative.
 */
export function reduceAutodialEvent(
  state: AutodialLiveState,
  event: AutodialSseEvent,
): AutodialLiveState {
  switch (event.type) {
    case 'snapshot':
      return {
        runtimes: Object.fromEntries(
          (event.campaigns ?? []).map((c) => [c.campaignUid, c]),
        ),
        channels: event.channels ?? [],
      };

    case 'channel_started':
      return {
        channels: [
          ...state.channels.filter((c) => c.channelId !== event.channel.channelId),
          event.channel,
        ],
        runtimes: patchRuntime(state, event.channel.campaignUid, (r) => ({
          ...r,
          dials: r.dials + 1,
        })),
      };

    case 'channel_answered':
      return {
        channels: state.channels.map((c) =>
          c.channelId === event.channelId && c.answeredAt === null
            ? { ...c, answeredAt: Date.now() }
            : c,
        ),
        runtimes: patchRuntime(state, event.campaignUid, (r) => ({
          ...r,
          answered: r.answered + 1,
        })),
      };

    case 'channel_ended':
      return {
        channels: state.channels.filter((c) => c.channelId !== event.channelId),
        runtimes: patchRuntime(state, event.campaignUid, (r) =>
          event.disposition === 'success' ? { ...r, success: r.success + 1 } : r,
        ),
      };

    case 'campaign_stats':
      return {
        channels: state.channels,
        runtimes: { ...state.runtimes, [event.runtime.campaignUid]: event.runtime },
      };

    case 'pacer':
      return {
        channels: state.channels,
        runtimes: patchRuntime(state, event.campaignUid, (r) => ({
          ...r,
          capacity: event.capacity,
          limitedBy: event.limitedBy,
          reserved: event.reserved,
          overDial: event.overDial,
          abandonPct: event.abandonPct,
        })),
      };

    default:
      return state;
  }
}
