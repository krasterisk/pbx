import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { LiveRoom, type LiveRoomParticipant } from './LiveRoom';
import { conferenceSdhFactory } from '../../lib/conferenceSdhFactory';

const here = dirname(fileURLToPath(import.meta.url));
const useIsMobileMock = vi.fn((_bp?: number) => false);
const muteParticipant = vi.fn();
const unmuteParticipant = vi.fn();
const kickParticipant = vi.fn();
const setRole = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string; count?: number; name?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback?.defaultValue) return fallback.defaultValue;
      if (typeof fallback?.count === 'number') {
        if (key === 'conferences.live.participantsCount') return `Участников: ${fallback.count}`;
      }
      if (fallback?.name && key === 'conferences.live.confirmKick') {
        return `Исключить "${fallback.name}" из конференции?`;
      }
      return key;
    },
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useMuteConferenceParticipantMutation: () => [muteParticipant, { isLoading: false }],
  useUnmuteConferenceParticipantMutation: () => [unmuteParticipant, { isLoading: false }],
  useKickConferenceParticipantMutation: () => [kickParticipant, { isLoading: false }],
  useSetConferenceParticipantRoleMutation: () => [setRole, { isLoading: false }],
  useSetConferenceMeVideoMutation: () => [vi.fn(), { isLoading: false }],
  useInviteConferenceMutation: () => [vi.fn(), { isPending: false }],
}));

vi.mock('@/shared/api/endpoints/conferenceMeetingsApi', () => ({
  useStartConferenceRecordingMutation: () => [vi.fn(), { isPending: false }],
  useStopConferenceRecordingMutation: () => [vi.fn(), { isPending: false }],
}));

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
          stream.getVideoTracks().forEach((existing) => {
            existing.stop();
            stream.removeTrack(existing);
          });
          stream.addTrack(track);
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
  beforeEach(() => {
    useIsMobileMock.mockImplementation((bp?: number) => (bp ?? 768) > 1400);
    muteParticipant.mockReturnValue({ unwrap: () => Promise.resolve() });
    unmuteParticipant.mockReturnValue({ unwrap: () => Promise.resolve() });
    kickParticipant.mockReturnValue({ unwrap: () => Promise.resolve() });
    setRole.mockReturnValue({ unwrap: () => Promise.resolve() });
  });

  it('always queries both viewport breakpoints so hook order stays stable', () => {
    useIsMobileMock.mockClear();
    render(<LiveRoom participants={[]} remoteTracks={{}} />);
    expect(useIsMobileMock).toHaveBeenCalledWith(1024);
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
  });

  it('renders two mid tiles and keeps the first remote video track live', () => {
    const factory = conferenceSdhFactory(async () => new MediaStream());
    const sdh = factory(
      { userAgent: { getLogger: () => ({ debug() {} }) } } as never,
      {},
    ) as unknown as { setRemoteTrack: (track: MediaStreamTrack) => void };
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

    const tiles = within(screen.getByTestId('conference-video-grid')).getAllByRole('listitem');
    expect(tiles).toHaveLength(2);
    expect(first.readyState).toBe('live');
    expect(tiles[0]).toHaveTextContent('Alice');
    expect(tiles[1]).toHaveTextContent('Bob');
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

    const tiles = within(screen.getByTestId('conference-video-grid')).getAllByRole('listitem');
    expect(tiles[0]).toHaveTextContent('Alice');
    expect(tiles[1]).toHaveTextContent('Bob');
    expect(tiles[0]).not.toHaveAttribute('aria-current', 'true');
    expect(tiles[1]).toHaveAttribute('aria-current', 'true');
  });

  it('forces videoFailed fallback on a flagged mid while the sibling tile stays mounted', async () => {
    const user = userEvent.setup();
    const first = fakeVideoTrack('mid-0');
    const second = fakeVideoTrack('mid-1');
    const onRetryVideo = vi.fn();
    render(
      <LiveRoom
        participants={[
          participant({ ref: 'a', displayName: 'Alice', video: true }),
          participant({ ref: 'b', displayName: 'Bob', video: true }),
        ]}
        remoteTracks={{ '0': first, '1': second }}
        videoFailedMids={['0']}
        onRetryVideo={onRetryVideo}
      />,
    );

    const tiles = within(screen.getByTestId('conference-video-grid')).getAllByRole('listitem');
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveAttribute('data-mid', '0');
    expect(within(tiles[0]).getByText('Видео не подключилось')).toBeInTheDocument();
    expect(tiles[0].querySelector('video')).toBeNull();
    expect(tiles[1]).toHaveAttribute('data-mid', '1');
    expect(tiles[1].querySelector('video')).toBeTruthy();
    expect(within(tiles[1]).queryByText('Видео не подключилось')).not.toBeInTheDocument();
    expect(first.readyState).toBe('live');
    expect(second.readyState).toBe('live');

    await user.click(within(tiles[0]).getByRole('button', { name: 'Повторить подключение видео' }));
    expect(onRetryVideo).toHaveBeenCalledTimes(1);
  });

  it('renders the local camera on the solo tile instead of a video-failed fallback', () => {
    const local = fakeVideoTrack('cam');
    const localStream = {
      getVideoTracks: () => [local],
    } as unknown as MediaStream;
    render(
      <LiveRoom
        participants={[participant({ ref: 'gst1', displayName: 'Гость тест' })]}
        remoteTracks={{}}
        localStream={localStream}
        selfName="Гость тест"
      />,
    );
    const tile = within(screen.getByTestId('conference-video-grid')).getByRole('listitem');
    expect(tile).toHaveAttribute('data-mid', 'local');
    expect(tile.querySelector('video')).toBeTruthy();
    expect(within(tile).queryByText('Видео не подключилось')).not.toBeInTheDocument();
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

    const tile = within(screen.getByTestId('conference-video-grid')).getByRole('listitem');
    expect(tile.className).toMatch(/singleTile/);
  });

  it('sets --conf-tile-min-width to 160px default and 120px at 640px', () => {
    const scss = readFileSync(resolve(here, 'VideoGrid.module.scss'), 'utf8');
    expect(scss).toMatch(/--conf-tile-min-width:\s*160px/);
    expect(scss).toMatch(/max-width:\s*640px/);
    expect(scss).toMatch(/--conf-tile-min-width:\s*120px/);
  });

  it('pulses the speaking outline and disables motion when reduced', () => {
    const scss = readFileSync(resolve(here, 'ParticipantTile.module.scss'), 'utf8');
    expect(scss).toMatch(/@keyframes/);
    expect(scss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(scss).toMatch(/animation:\s*none/);
  });
});

describe('LiveRoom participant rail (16.3-05 D-26 / D-37)', () => {
  beforeEach(() => {
    useIsMobileMock.mockImplementation((bp?: number) => (bp ?? 768) > 1400);
    muteParticipant.mockClear();
    unmuteParticipant.mockClear();
    kickParticipant.mockClear();
    setRole.mockClear();
    muteParticipant.mockReturnValue({ unwrap: () => Promise.resolve() });
  });

  it('renders a 320px column at desktop and a Sheet below 1024', async () => {
    const user = userEvent.setup();
    const first = fakeVideoTrack('mid-0');
    const { rerender } = render(
      <LiveRoom
        roomUid={7}
        selfRole="owner"
        participants={[participant({ ref: 'a', displayName: 'Alice', muted: true })]}
        remoteTracks={{ '0': first }}
      />,
    );

    const rail = screen.getByTestId('participant-list');
    expect(rail).toHaveStyle({ width: '320px' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const scss = readFileSync(resolve(here, 'ParticipantList.module.scss'), 'utf8');
    expect(scss).toMatch(/width:\s*320px/);
    expect(scss).toMatch(/min-height:\s*44px/);

    useIsMobileMock.mockImplementation((bp?: number) => (bp ?? 768) >= 1024);
    rerender(
      <LiveRoom
        roomUid={7}
        selfRole="owner"
        participants={[participant({ ref: 'a', displayName: 'Alice', muted: true })]}
        remoteTracks={{ '0': first }}
      />,
    );

    const toggle = screen.getByRole('button', { name: 'Участники' });
    expect(toggle).toHaveAttribute('aria-controls', 'conference-participants');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('conference-participants')).toBeTruthy();
  });

  it('optimistically mutes via the RTK mutation and offers kick confirm triples', async () => {
    const user = userEvent.setup();
    render(
      <LiveRoom
        roomUid={7}
        selfRole="moderator"
        participants={[
          participant({ ref: 'bob', displayName: 'Bob', muted: false, role: 'participant' }),
        ]}
        remoteTracks={{ '0': fakeVideoTrack('mid-0') }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Bob' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Заглушить участника' }));
    expect(muteParticipant).toHaveBeenCalledWith({ roomUid: 7, ref: 'bob' });

    const api = readFileSync(
      resolve(here, '../../../../shared/api/endpoints/conferenceRoomApi.ts'),
      'utf8',
    );
    expect(api).toMatch(/updateQueryData\('getConferenceRoom'/);
    expect(api).toMatch(/patchResult\.undo\(\)/);
    expect(api).toMatch(/toast\.error/);

    await user.click(screen.getByRole('button', { name: 'Bob' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Исключить участника' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Исключить "Bob" из конференции?')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Оставить участника' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Исключить участника' })).toBeInTheDocument();
  });

  it('shows only MicOff, VideoOff, role badge and speaking outline — no raised-hand', () => {
    render(
      <LiveRoom
        roomUid={7}
        selfRole="participant"
        participants={[
          participant({
            ref: 'a',
            displayName: 'Alice',
            muted: true,
            video: false,
            speaking: true,
            role: 'moderator',
          }),
        ]}
        remoteTracks={{ '0': fakeVideoTrack('mid-0') }}
      />,
    );

    const row = screen.getByTestId('participant-row-a');
    expect(row.className).toMatch(/speaking/);
    expect(row.querySelector('.lucide-mic-off')).toBeTruthy();
    expect(row.querySelector('.lucide-video-off')).toBeTruthy();
    expect(within(row).getByText('Модератор')).toBeInTheDocument();
    expect(row.textContent).not.toMatch(/gst|channel|raised|hand|MOS/i);
    expect(screen.queryByRole('button', { name: 'Alice' })).not.toBeInTheDocument();

    const sources = [
      readFileSync(resolve(here, 'ParticipantList.tsx'), 'utf8'),
      readFileSync(resolve(here, 'ParticipantRow.tsx'), 'utf8'),
    ].join('\n');
    expect(sources).not.toMatch(/raised-hand|raisedHand|handRaise/i);
    expect(sources).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it('shows a 56px header, join CTA, banners over the stage, and a hidden audio element', () => {
    render(
      <LiveRoom
        roomUid={7}
        selfRole="owner"
        roomName="Standup"
        roomNumber="8001"
        recording
        startedAt="2026-09-16T12:00:00.000Z"
        status="idle"
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        onEnd={vi.fn()}
        waitingForModerator={false}
        reconnecting
        weakLink
        disconnected
        adminJoinNotice
        inviteExternalScope="moderator"
        canRecord
        isMuted={false}
        isCameraOff={false}
        participants={[participant({ ref: 'a', displayName: 'Alice' })]}
        remoteTracks={{ '0': fakeVideoTrack('mid-0') }}
      />,
    );

    const header = screen.getByTestId('live-room-header');
    expect(header).toHaveStyle({ height: '56px' });
    expect(header).toHaveTextContent('Standup');
    expect(header).toHaveTextContent('8001');
    expect(header).toHaveTextContent('Идёт запись');
    expect(screen.queryByRole('button', { name: 'Войти в конференцию' })).not.toBeInTheDocument();
    expect(screen.getByTestId('live-room-stage').querySelector('[data-banner="disconnected"]')).toBeTruthy();
    expect(screen.getByTestId('live-room-stage').querySelector('[data-banner="weakLink"]')).toBeTruthy();
    const disconnected = screen.getByTestId('live-room-stage').querySelector('[data-banner="disconnected"]');
    expect(disconnected).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByText('Вход администратора в эту встречу записывается в журнал событий.')).toBeInTheDocument();
    const audio = document.querySelector('audio');
    expect(audio).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('conference-video-grid')).toBeInTheDocument();
  });

  it('shows connecting overlay while status is connecting', () => {
    render(
      <LiveRoom
        roomUid={7}
        roomName="Standup"
        status="connecting"
        participants={[]}
        remoteTracks={{}}
        localStream={
          {
            getVideoTracks: () => [fakeVideoTrack('cam')],
            getTracks: () => [fakeVideoTrack('cam')],
          } as unknown as MediaStream
        }
        selfName="Гость"
      />,
    );
    expect(screen.getByTestId('live-room-stage').querySelector('[data-banner="connecting"]')).toBeTruthy();
    expect(screen.getByText('Подключаемся…')).toBeInTheDocument();
    expect(screen.queryByText('В комнате пока никого нет')).not.toBeInTheDocument();
  });

  it('blocks UA start copy and does not render join when noWebrtcCompanion', () => {
    render(
      <LiveRoom
        roomUid={7}
        error="noWebrtcCompanion"
        status="error"
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        participants={[]}
        remoteTracks={{}}
      />,
    );
    expect(screen.getByText(/нет WebRTC-абонента/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Войти в конференцию' })).not.toBeInTheDocument();
  });
});
