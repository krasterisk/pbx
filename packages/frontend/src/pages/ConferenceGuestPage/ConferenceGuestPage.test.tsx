import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const here = dirname(fileURLToPath(import.meta.url));

const leave = vi.fn(async () => undefined);
const guestLeave = vi.fn(() => ({ unwrap: vi.fn() }));
const joinUnwrap = vi.fn(async () => ({
  sipId: 'gst1',
  password: 'join-secret',
  sipDomain: 'pbx.example',
  roomUid: 7,
}));
const guestJoin = vi.fn(() => ({ unwrap: joinUnwrap }));

let roomStatus: 'idle' | 'connecting' | 'registered' | 'in-call' | 'error' = 'idle';
let conferenceRoomArgs: Record<string, unknown> = {};
let webrtcToken: string | undefined;
let guestMeta: {
  name: string;
  entry_strictness: string;
  requiresPin: boolean;
  participants?: Array<{
    ref: string;
    displayName: string;
    role: 'owner' | 'moderator' | 'participant';
    speaking: boolean;
    muted: boolean;
    video: boolean;
  }>;
  waitingForModerator?: boolean;
  recording?: boolean;
} = {
  name: 'Standup',
  entry_strictness: 'token_name',
  requiresPin: false,
};
let metaError: unknown;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _key),
    i18n: { language: 'ru', changeLanguage: vi.fn() },
  }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'guest-token-1' }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/features/callcenter/lib/useAudioDevices', () => ({
  useAudioDevices: () => ({
    microphones: [],
    speakers: [],
    selectedMic: 'default',
    setSelectedMic: vi.fn(),
    selectedSpeaker: 'default',
    setSelectedSpeaker: vi.fn(),
    refresh: vi.fn(),
  }),
  audioDeviceLabel: (d: { label: string }, index: number, kind: string) =>
    d.label || `${kind} ${index + 1}`,
}));

vi.mock('@/features/conferences/lib/useConferenceSse', () => ({
  useConferenceSse: vi.fn(),
}));

vi.mock('@/features/conferences/lib/useConferenceRoom', () => ({
  useConferenceRoom: (opts: Record<string, unknown>) => {
    conferenceRoomArgs = opts;
    return {
      status: roomStatus,
      error: null,
      remoteTracks: {},
      videoFailedMids: [],
      leave,
      retryVideo: vi.fn(),
    };
  },
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useGuestGetQuery: () => ({ data: guestMeta, error: metaError }),
  useGuestWebrtcConfigQuery: (token: string) => {
    webrtcToken = token;
    return { data: { wssUrl: 'wss://pbx.example/ws', iceServers: [] } };
  },
  useGuestJoinMutation: () => [guestJoin, { isLoading: false, error: undefined }],
  useGuestLeaveMutation: () => [guestLeave],
  useSetConferenceMeVideoMutation: () => [vi.fn(), { isLoading: false }],
  useMuteConferenceParticipantMutation: () => [vi.fn(), { isLoading: false }],
  useUnmuteConferenceParticipantMutation: () => [vi.fn(), { isLoading: false }],
  useKickConferenceParticipantMutation: () => [vi.fn(), { isLoading: false }],
  useSetConferenceParticipantRoleMutation: () => [vi.fn(), { isLoading: false }],
  useInviteConferenceMutation: () => [vi.fn(), { isPending: false }],
}));

vi.mock('@/shared/api/endpoints/conferenceMeetingsApi', () => ({
  useStartConferenceRecordingMutation: () => [vi.fn(), { isPending: false }],
  useStopConferenceRecordingMutation: () => [vi.fn(), { isPending: false }],
}));

import { ConferenceGuestPage } from './ConferenceGuestPage';

async function joinAsGuest() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Как вас представить'), 'Гость');
  await user.click(screen.getByRole('button', { name: 'Присоединиться к конференции' }));
}

function assertNoPbxChrome() {
  expect(screen.queryByTestId('module-shell')).not.toBeInTheDocument();
  expect(document.getElementById('shell-cmdk-trigger')).toBeNull();
  expect(document.getElementById('shell-agent-trigger')).toBeNull();
  expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
  expect(screen.queryByTestId('ai-agent-panel')).not.toBeInTheDocument();
  expect(screen.queryByTestId('softphone-widget-trigger')).not.toBeInTheDocument();
}

describe('ConferenceGuestPage (16.3-07 D-28)', () => {
  beforeEach(() => {
    leave.mockClear();
    guestJoin.mockClear();
    joinUnwrap.mockClear();
    guestLeave.mockClear();
    roomStatus = 'idle';
    conferenceRoomArgs = {};
    webrtcToken = undefined;
    guestMeta = { name: 'Standup', entry_strictness: 'token_name', requiresPin: false };
    metaError = undefined;
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getUserMedia: vi.fn().mockResolvedValue({}),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it('keeps the orchestrator at 70 lines or fewer and reuses LiveRoom', () => {
    const source = readFileSync(resolve(here, './ConferenceGuestPage.tsx'), 'utf8');
    expect(source.split(/\r?\n/).length).toBeLessThanOrEqual(70);
    expect(source).toMatch(/from '@\/features\/conferences\/ui\/LiveRoom'/);
    expect(source).not.toMatch(/sessionStorage|localStorage/);
    expect(source).not.toMatch(/webrtc-config[\s\S]{0,80}password/);
  });

  it('does not leak PBX chrome on the full guest page tree', () => {
    render(<ConferenceGuestPage />);
    expect(screen.getByTestId('conference-guest-shell')).toBeInTheDocument();
    assertNoPbxChrome();
  });

  it('keeps waitingForModerator on the PreJoinCard lobby, not LiveRoom', async () => {
    guestMeta = { ...guestMeta, entry_strictness: 'token_name_pin_moderator' };
    roomStatus = 'connecting';
    render(<ConferenceGuestPage />);
    await joinAsGuest();
    expect(await screen.findByText('Ждём одобрения модератора')).toBeInTheDocument();
    expect(screen.queryByTestId('live-room-header')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Присоединиться к конференции' })).toBeDisabled();
  });

  it('mounts the same LiveRoom after guestJoin and hides host-only controls', async () => {
    roomStatus = 'in-call';
    render(<ConferenceGuestPage />);
    await joinAsGuest();
    expect(await screen.findByTestId('live-room-header')).toBeInTheDocument();
    expect(screen.getByTestId('live-room-stage')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Завершить конференцию' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Пригласить абонента' })).not.toBeInTheDocument();
    expect(conferenceRoomArgs.sipPassword).toBe('join-secret');
    expect(webrtcToken).toBe('guest-token-1');
    expect(JSON.stringify(conferenceRoomArgs.iceServers ?? [])).not.toContain('join-secret');
  });

  it('feeds LiveRoom participants from guestGet instead of a compile-time empty array', async () => {
    guestMeta = {
      ...guestMeta,
      participants: [
        {
          ref: 'gst-alice',
          displayName: 'Алиса',
          role: 'participant',
          speaking: false,
          muted: false,
          video: false,
        },
      ],
    };
    roomStatus = 'in-call';
    const source = readFileSync(resolve(here, './ConferenceGuestPage.tsx'), 'utf8');
    expect(source).not.toMatch(/participants=\{\[\]\}/);
    expect(source).toMatch(/participants=\{meta\?\.participants/);
    expect(source).toMatch(/videoFailedMids=\{room\.videoFailedMids\}/);
    render(<ConferenceGuestPage />);
    await joinAsGuest();
    expect(await screen.findByTestId('live-room-header')).toBeInTheDocument();
    expect(screen.getByText('Алиса')).toBeInTheDocument();
    expect(screen.queryByText('В комнате пока никого нет')).not.toBeInTheDocument();
  });

  it('shows guest.left after the participant leaves', async () => {
    roomStatus = 'in-call';
    render(<ConferenceGuestPage />);
    await joinAsGuest();
    await screen.findByTestId('live-room-header');
    await userEvent.click(screen.getByRole('button', { name: 'Выйти из конференции' }));
    expect(screen.getByText('Вы вышли из конференции')).toBeInTheDocument();
    expect(screen.getByText(/Страницу можно закрыть/)).toBeInTheDocument();
  });
});
