import { describe, expect, it, vi } from 'vitest';
import { conferenceSdhFactory } from './conferenceSdhFactory';

type RemoteStreamLike = {
  getTrackById: (id: string) => MediaStreamTrack | undefined;
  getVideoTracks: () => MediaStreamTrack[];
  addTrack: (track: MediaStreamTrack) => void;
  removeTrack: (track: MediaStreamTrack) => void;
};

type SdhLike = {
  _remoteMediaStream: RemoteStreamLike;
  setRemoteTrack: (track: MediaStreamTrack) => void;
};

vi.mock('sip.js', () => ({
  Web: {
    defaultSessionDescriptionHandlerFactory: () => () => {
      const tracks: MediaStreamTrack[] = [];
      const stream = {
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
    },
  },
}));

function fakeVideoTrack(id: string): MediaStreamTrack {
  const track = {
    id,
    kind: 'video',
    readyState: 'live' as MediaStreamTrackState,
    label: id,
    enabled: true,
    muted: false,
    stop() {
      this.readyState = 'ended';
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
  };
  return track as unknown as MediaStreamTrack;
}

const fakeSdhSession = {
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
  it('does not throw when the factory is invoked with zero remote tracks', () => {
    expect(() => {
      const factory = conferenceSdhFactory(async () => new MediaStream());
      factory(fakeSdhSession as never, {});
    }).not.toThrow();
  });

  it('adds a second video track by id without stopping the first', () => {
    const factory = conferenceSdhFactory(async () => new MediaStream());
    const sdh = factory(fakeSdhSession as never, {}) as SdhLike;
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
