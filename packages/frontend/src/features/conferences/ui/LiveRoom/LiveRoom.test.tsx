import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Web } from 'sip.js';
import { LiveRoom, type LiveRoomParticipant } from './LiveRoom';
import { conferenceSdhFactory } from '../../lib/conferenceSdhFactory';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
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

function participant(
  overrides: Partial<LiveRoomParticipant> & Pick<LiveRoomParticipant, 'ref' | 'displayName'>,
): LiveRoomParticipant {
  return {
    role: 'participant',
    speaking: false,
    muted: false,
    video: true,
    ...overrides,
  };
}

describe('LiveRoom (16.3-01 R-SDH)', () => {
  it('renders two mid tiles and keeps the first remote video track live', () => {
    const tracks: MediaStreamTrack[] = [];
    vi.spyOn(Web, 'defaultSessionDescriptionHandlerFactory').mockImplementation(
      () =>
        () =>
          ({
            _remoteMediaStream: {
              getTrackById: (id: string) => tracks.find((item) => item.id === id),
              getVideoTracks: () => tracks.filter((item) => item.kind === 'video'),
              addTrack(track: MediaStreamTrack) {
                tracks.push(track);
              },
              removeTrack(track: MediaStreamTrack) {
                const index = tracks.indexOf(track);
                if (index >= 0) tracks.splice(index, 1);
              },
            },
            setRemoteTrack(track: MediaStreamTrack) {
              tracks.forEach((existing) => {
                if (existing.kind === 'video') existing.stop();
              });
              tracks.push(track);
            },
          }) as never,
    );

    const factory = conferenceSdhFactory(async () => new MediaStream());
    const sdh = factory(
      { userAgent: { getLogger: () => ({ debug() {} }) } },
      {},
    ) as { setRemoteTrack: (track: MediaStreamTrack) => void };
    const first = fakeVideoTrack('mid-0');
    const second = fakeVideoTrack('mid-1');
    sdh.setRemoteTrack(first);
    sdh.setRemoteTrack(second);

    render(
      <LiveRoom
        participants={[
          participant({ ref: 'a', displayName: 'Alice' }),
          participant({ ref: 'b', displayName: 'Bob' }),
        ]}
        remoteTracks={{ '0': first, '1': second }}
      />,
    );

    const tiles = screen.getAllByRole('listitem');
    expect(tiles).toHaveLength(2);
    expect(first.readyState).toBe('live');
    expect(tiles[0]).toHaveTextContent('Alice');
    expect(tiles[1]).toHaveTextContent('Bob');
    vi.restoreAllMocks();
  });

  it('keeps mid order when the second tile is speaking', () => {
    const first = fakeVideoTrack('mid-0');
    const second = fakeVideoTrack('mid-1');
    render(
      <LiveRoom
        participants={[
          participant({ ref: 'a', displayName: 'Alice', speaking: false }),
          participant({ ref: 'b', displayName: 'Bob', speaking: true }),
        ]}
        remoteTracks={{ '0': first, '1': second }}
      />,
    );

    const tiles = screen.getAllByRole('listitem');
    expect(tiles[0]).toHaveTextContent('Alice');
    expect(tiles[1]).toHaveTextContent('Bob');
    expect(tiles[0]).not.toHaveAttribute('aria-current', 'true');
    expect(tiles[1]).toHaveAttribute('aria-current', 'true');
  });

  it('shows empty-room fallback copy when there are no participants', () => {
    render(<LiveRoom participants={[]} remoteTracks={{}} />);
    expect(screen.getByText('В комнате пока никого нет')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Позовите участников по короткому номеру или отправьте ссылку приглашения.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('applies a max-width class when there is a single tile (A1)', () => {
    const track = fakeVideoTrack('mid-0');
    render(
      <LiveRoom
        participants={[participant({ ref: 'a', displayName: 'Alice' })]}
        remoteTracks={{ '0': track }}
      />,
    );

    const tile = screen.getByRole('listitem');
    expect(tile.className).toMatch(/singleTile/);
  });
});
