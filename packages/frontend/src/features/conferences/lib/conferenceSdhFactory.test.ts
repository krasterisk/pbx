import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Web } from 'sip.js';
import { conferenceSdhFactory } from './conferenceSdhFactory';

type RemoteStreamLike = {
  getTrackById: (id: string) => MediaStreamTrack | undefined;
  getVideoTracks: () => MediaStreamTrack[];
  addTrack: (track: MediaStreamTrack) => void;
  removeTrack: (track: MediaStreamTrack) => void;
};

export type SdhLike = {
  _remoteMediaStream: RemoteStreamLike;
  setRemoteTrack: (track: MediaStreamTrack) => void;
};

export function fakeVideoTrack(id: string): MediaStreamTrack {
  const track = {
    id,
    kind: 'video',
    readyState: 'live' as MediaStreamTrackState,
    label: id,
    enabled: true,
    muted: false,
    contentHint: '',
    onended: null,
    onmute: null,
    onunmute: null,
    stop() {
      this.readyState = 'ended';
    },
    clone() {
      return this as unknown as MediaStreamTrack;
    },
    getConstraints() {
      return {};
    },
    getSettings() {
      return {};
    },
    getCapabilities() {
      return {};
    },
    applyConstraints() {
      return Promise.resolve();
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };
  return track as unknown as MediaStreamTrack;
}

export function createStockRemoteStream(): RemoteStreamLike {
  const tracks: MediaStreamTrack[] = [];
  return {
    getTrackById(id: string) {
      return tracks.find((item) => item.id === id);
    },
    getVideoTracks() {
      return tracks.filter((item) => item.kind === 'video');
    },
    addTrack(track: MediaStreamTrack) {
      tracks.push(track);
    },
    removeTrack(track: MediaStreamTrack) {
      const index = tracks.indexOf(track);
      if (index >= 0) tracks.splice(index, 1);
    },
  };
}

export function createStockSdh(): SdhLike {
  const stream = createStockRemoteStream();
  return {
    _remoteMediaStream: stream,
    setRemoteTrack(track: MediaStreamTrack) {
      if (stream.getTrackById(track.id)) return;
      if (track.kind === 'video') {
        stream.getVideoTracks().forEach((existing) => {
          existing.stop();
          stream.removeTrack(existing);
        });
        stream.addTrack(track);
      }
    },
  };
}

export const fakeSdhSession = {
  userAgent: {
    getLogger: () => ({
      debug() {},
      error() {},
      warn() {},
      log() {},
    }),
  },
};

describe('conferenceSdhFactory (R-SDH)', () => {
  beforeEach(() => {
    vi.spyOn(Web, 'defaultSessionDescriptionHandlerFactory').mockImplementation(
      () => () => createStockSdh() as never,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not throw when the factory is invoked with zero remote tracks', () => {
    expect(() => {
      const factory = conferenceSdhFactory(async () => new MediaStream());
      factory(fakeSdhSession, {});
    }).not.toThrow();
  });

  it('adds a second video track by id without stopping the first', () => {
    const factory = conferenceSdhFactory(async () => new MediaStream());
    const sdh = factory(fakeSdhSession, {}) as SdhLike;
    const first = fakeVideoTrack('v1');
    const second = fakeVideoTrack('v2');

    sdh.setRemoteTrack(first);
    sdh.setRemoteTrack(second);

    expect(first.readyState).toBe('live');
    expect(second.readyState).toBe('live');
    expect(sdh._remoteMediaStream.getVideoTracks().map((track) => track.id)).toEqual([
      'v1',
      'v2',
    ]);
  });
});
