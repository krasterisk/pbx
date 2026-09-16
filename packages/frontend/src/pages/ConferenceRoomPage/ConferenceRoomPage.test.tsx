import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { enterSession, leaveSession } from '@/features/conferences/model/slice/conferenceSessionSlice';

const here = dirname(fileURLToPath(import.meta.url));
const dispatch = vi.fn();
const leave = vi.fn(async () => undefined);
let roomStatus: 'idle' | 'connecting' | 'registered' | 'in-call' | 'error' = 'idle';
let roomError: 'noWebrtcCompanion' | null = null;
let conferenceRoomArgs: Record<string, unknown> = {};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _key),
  }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ uid: '7' }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
  useAppSelector: (sel: (s: unknown) => unknown) => sel({ auth: { user: { uniqueid: 3 } } }),
}));

vi.mock('@/entities/User', () => ({
  selectCurrentUser: (s: { auth: { user: { uniqueid: number } } }) => s.auth.user,
}));

vi.mock('@/features/conferences/model/slice/conferenceSessionSlice', async () => {
  const actual = await vi.importActual<typeof import('@/features/conferences/model/slice/conferenceSessionSlice')>(
    '@/features/conferences/model/slice/conferenceSessionSlice',
  );
  return {
    ...actual,
    enterSession: vi.fn((payload: unknown) => ({ type: 'conferenceSession/enterSession', payload })),
    leaveSession: vi.fn(() => ({ type: 'conferenceSession/leaveSession' })),
  };
});

vi.mock('@/features/conferences/lib/useConferenceSse', () => ({
  useConferenceSse: vi.fn(),
}));

vi.mock('@/features/conferences/lib/useConferenceRoom', () => ({
  useConferenceRoom: (opts: Record<string, unknown>) => {
    conferenceRoomArgs = opts;
    return {
      status: roomStatus,
      error: roomError,
      remoteTracks: {},
      videoFailedMids: [],
      leave,
      retryVideo: vi.fn(),
    };
  },
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useGetConferenceRoomQuery: () => ({
    data: {
      uid: 7,
      number: '8001',
      name: 'Standup',
      created_by: 9,
      record_mode: 'button',
      invite_external_scope: 'moderator',
      participants: [],
      recording: false,
    },
    error: undefined,
  }),
  usePostConferenceTelemetryMutation: () => [vi.fn(), { isLoading: false }],
  useInviteConferenceMutation: () => [vi.fn(), { isPending: false }],
  useMuteConferenceParticipantMutation: () => [vi.fn(), { isLoading: false }],
  useUnmuteConferenceParticipantMutation: () => [vi.fn(), { isLoading: false }],
  useKickConferenceParticipantMutation: () => [vi.fn(), { isLoading: false }],
  useSetConferenceParticipantRoleMutation: () => [vi.fn(), { isLoading: false }],
  useSetConferenceMeVideoMutation: () => [vi.fn(), { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/conferenceMeetingsApi', () => ({
  useStartConferenceRecordingMutation: () => [vi.fn(), { isPending: false }],
  useStopConferenceRecordingMutation: () => [vi.fn(), { isPending: false }],
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetWebrtcConfigQuery: () => ({ data: { wssUrl: 'wss://pbx.example/ws', iceServers: [] } }),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointCredentialsQuery: () => ({
    data: { sipId: 'ew101_1', username: 'ew101_1', password: 'secret', domain: 'pbx.example' },
  }),
}));

vi.mock('@/features/callcenter/lib/shiftSession', () => ({
  loadActiveShift: () => ({ sipId: 'ew101_1', endpointId: 'e101_1', mode: 'webrtc', interface: 'PJSIP/ew101_1', queues: [] }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

import { ConferenceRoomPage } from './ConferenceRoomPage';

describe('ConferenceRoomPage (16.3-05 D-26)', () => {
  beforeEach(() => {
    dispatch.mockClear();
    leave.mockClear();
    roomStatus = 'idle';
    roomError = null;
    conferenceRoomArgs = {};
  });

  it('keeps the orchestrator at 70 lines or fewer', () => {
    const source = readFileSync(resolve(here, './ConferenceRoomPage.tsx'), 'utf8');
    expect(source.split(/\r?\n/).length).toBeLessThanOrEqual(70);
  });

  it('renders the three LiveRoom zones', () => {
    render(<ConferenceRoomPage />);
    expect(screen.getByTestId('conference-room-page')).toBeInTheDocument();
    expect(screen.getByTestId('live-room-header')).toBeInTheDocument();
    expect(screen.getByTestId('live-room-stage')).toBeInTheDocument();
    expect(screen.getByTestId('room-control-bar')).toBeInTheDocument();
    expect(screen.getByText('8001')).toBeInTheDocument();
    expect(screen.queryByText(/tenant/i)).not.toBeInTheDocument();
  });

  it('dispatches enterSession after the conference UA is Established', () => {
    roomStatus = 'in-call';
    render(<ConferenceRoomPage />);
    expect(enterSession).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'conferenceSession/enterSession' }),
    );
  });

  it('does not start the UA when there is no WebRTC companion', () => {
    roomError = 'noWebrtcCompanion';
    roomStatus = 'error';
    render(<ConferenceRoomPage />);
    expect(conferenceRoomArgs.sipId == null || conferenceRoomArgs.sipPassword == null).toBe(true);
    expect(screen.getByText(/нет WebRTC-абонента/)).toBeInTheDocument();
  });

  it('leaves the session on unmount', () => {
    const { unmount } = render(<ConferenceRoomPage />);
    unmount();
    expect(leaveSession).toHaveBeenCalled();
  });
});
