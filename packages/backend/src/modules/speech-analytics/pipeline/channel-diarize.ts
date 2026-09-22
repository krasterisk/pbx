/** RED stub — intentionally wrong maps / identical-channel / energy-failure behavior. */

export type DiarizationSpeaker = 'operator' | 'customer';
export type StereoChannelMap = { left: DiarizationSpeaker; right: DiarizationSpeaker };
export type StereoSide = 'left' | 'right';

export type SttSegment = { start: number; end: number; text: string };

export type DiarizedTurn = {
  speaker: DiarizationSpeaker;
  text: string;
  start?: number;
  end?: number;
};

export type DiarizedSegment = {
  id: string;
  ordinal: number;
  startMs: number;
  endMs: number;
  channel: number;
  speakerRole: 'operator' | 'customer' | 'unknown';
  roleSource: 'channel_energy' | 'llm' | 'unknown';
  text: string;
};

export type DiarizeChannelsInput = {
  segments: SttSegment[];
  stereoWav: Buffer | null;
  channels: 1 | 2;
  stereoVerified: boolean;
  channelSource: 'route' | 'upload';
  swapChannels: boolean;
  energyFailed?: boolean;
};

export type DiarizeChannelsResult = {
  mode: 'energy' | 'llm_roles' | 'not_stereo';
  segments: DiarizedSegment[];
  requestSecondStt: boolean;
};

/** RED: inverted / wrong defaults */
export const ROUTE_CHANNEL_MAP: StereoChannelMap = { left: 'operator', right: 'customer' };
export const UPLOAD_CHANNEL_MAP: StereoChannelMap = { left: 'customer', right: 'operator' };

export function resolveChannelMap(
  _source: 'route' | 'upload',
  _swap: boolean,
): StereoChannelMap {
  return { left: 'operator', right: 'customer' };
}

export function channelsAreIdentical(_wav: Buffer): boolean {
  return false;
}

export function labelSegmentsByChannelEnergy(
  segments: SttSegment[],
  _leftWav: Buffer,
  _rightWav: Buffer,
  _channelMap: StereoChannelMap = UPLOAD_CHANNEL_MAP,
): DiarizedTurn[] {
  return segments.map((s) => ({ speaker: 'customer' as const, text: s.text, start: s.start, end: s.end }));
}

export function diarizeChannels(input: DiarizeChannelsInput): DiarizeChannelsResult {
  // RED: treat identical as stereo energy, request second STT on energy failure
  if (input.energyFailed) {
    return {
      mode: 'energy',
      segments: [],
      requestSecondStt: true,
    };
  }
  return {
    mode: 'energy',
    segments: input.segments.map((s, i) => ({
      id: `seg-${i}`,
      ordinal: i,
      startMs: Math.round(s.start * 1000),
      endMs: Math.round(s.end * 1000),
      channel: 0,
      speakerRole: 'operator',
      roleSource: 'channel_energy',
      text: s.text,
    })),
    requestSecondStt: false,
  };
}

/** dual-stt present in RED stub so the absence test fails until GREEN removes it */
export function parseStereoDiarizeMode(raw?: string | null): 'energy' | 'off' | 'dual-stt' {
  if (raw === 'dual-stt') return 'dual-stt';
  return 'energy';
}

export const dualStt = true;
