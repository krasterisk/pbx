import {
  emptyAutodialLiveState,
  reduceAutodialEvent,
  type AutodialCampaignRuntime,
  type AutodialLiveChannel,
  type AutodialLiveState,
} from './autodialLiveState';

function channel(overrides: Partial<AutodialLiveChannel> = {}): AutodialLiveChannel {
  return {
    channelId: 'ac-1-2-3',
    campaignUid: 1,
    taskUid: 2,
    attemptUid: 3,
    attemptNo: 1,
    number: '79990000001',
    trunkId: 'trunk-a',
    startedAt: 1_700_000_000_000,
    answeredAt: null,
    ...overrides,
  };
}

function runtime(overrides: Partial<AutodialCampaignRuntime> = {}): AutodialCampaignRuntime {
  return {
    campaignUid: 1,
    status: 'running',
    capacity: 4,
    limitedBy: 'queue_agents',
    reserved: 0,
    dials: 10,
    answered: 4,
    success: 2,
    ...overrides,
  };
}

describe('reduceAutodialEvent', () => {
  it('replaces everything on a snapshot', () => {
    const dirty: AutodialLiveState = {
      runtimes: { 9: runtime({ campaignUid: 9 }) },
      channels: [channel({ channelId: 'stale' })],
    };
    const next = reduceAutodialEvent(dirty, {
      type: 'snapshot',
      campaigns: [runtime()],
      channels: [channel()],
    });
    expect(Object.keys(next.runtimes)).toEqual(['1']);
    expect(next.channels).toHaveLength(1);
    expect(next.channels[0].channelId).toBe('ac-1-2-3');
  });

  it('tolerates a snapshot with missing arrays', () => {
    const next = reduceAutodialEvent(emptyAutodialLiveState, {
      type: 'snapshot',
    } as never);
    expect(next).toEqual(emptyAutodialLiveState);
  });

  it('adds a channel and counts the dial even for an unknown campaign', () => {
    const next = reduceAutodialEvent(emptyAutodialLiveState, {
      type: 'channel_started',
      channel: channel(),
    });
    expect(next.channels).toHaveLength(1);
    expect(next.runtimes[1].dials).toBe(1);
  });

  it('does not duplicate a channel that is re-announced', () => {
    let state = reduceAutodialEvent(emptyAutodialLiveState, {
      type: 'channel_started',
      channel: channel(),
    });
    state = reduceAutodialEvent(state, { type: 'channel_started', channel: channel() });
    expect(state.channels).toHaveLength(1);
  });

  it('stamps answeredAt once and counts the answer', () => {
    const started = reduceAutodialEvent(emptyAutodialLiveState, {
      type: 'channel_started',
      channel: channel(),
    });
    const answered = reduceAutodialEvent(started, {
      type: 'channel_answered',
      channelId: 'ac-1-2-3',
      campaignUid: 1,
    });
    const at = answered.channels[0].answeredAt;
    expect(at).not.toBeNull();
    expect(answered.runtimes[1].answered).toBe(1);

    const again = reduceAutodialEvent(answered, {
      type: 'channel_answered',
      channelId: 'ac-1-2-3',
      campaignUid: 1,
    });
    expect(again.channels[0].answeredAt).toBe(at);
  });

  it('drops the channel on end and only counts success dispositions', () => {
    const started = reduceAutodialEvent(emptyAutodialLiveState, {
      type: 'channel_started',
      channel: channel(),
    });
    const busy = reduceAutodialEvent(started, {
      type: 'channel_ended',
      channelId: 'ac-1-2-3',
      campaignUid: 1,
      disposition: 'busy',
    });
    expect(busy.channels).toHaveLength(0);
    expect(busy.runtimes[1].success).toBe(0);

    const ok = reduceAutodialEvent(started, {
      type: 'channel_ended',
      channelId: 'ac-1-2-3',
      campaignUid: 1,
      disposition: 'success',
    });
    expect(ok.runtimes[1].success).toBe(1);
  });

  it('keeps accumulated counters when the pacer reports capacity', () => {
    const state: AutodialLiveState = { runtimes: { 1: runtime() }, channels: [] };
    const next = reduceAutodialEvent(state, {
      type: 'pacer',
      campaignUid: 1,
      capacity: 7,
      limitedBy: 'trunk_channels',
      reserved: 2,
    });
    expect(next.runtimes[1]).toMatchObject({
      capacity: 7,
      limitedBy: 'trunk_channels',
      reserved: 2,
      dials: 10,
      answered: 4,
    });
  });

  it('treats campaign_stats as authoritative', () => {
    const state: AutodialLiveState = { runtimes: { 1: runtime() }, channels: [] };
    const next = reduceAutodialEvent(state, {
      type: 'campaign_stats',
      runtime: runtime({ dials: 99, status: 'paused' }),
    });
    expect(next.runtimes[1].dials).toBe(99);
    expect(next.runtimes[1].status).toBe('paused');
  });

  it('ignores an unknown frame instead of throwing', () => {
    const state: AutodialLiveState = { runtimes: { 1: runtime() }, channels: [] };
    expect(reduceAutodialEvent(state, { type: 'heartbeat' } as never)).toBe(state);
  });
});
