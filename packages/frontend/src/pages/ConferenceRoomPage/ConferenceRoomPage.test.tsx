import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const here = dirname(fileURLToPath(import.meta.url));
const startMedia = vi.fn();
const hangup = vi.fn(async () => undefined);
let hostStatus: 'idle' | 'connecting' | 'registered' | 'in-call' | 'error' = 'idle';
let hostError: 'noWebrtcCompanion' | null = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _key),
  }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ uid: '7' }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (sel: (s: unknown) => unknown) => sel({ auth: { user: { uniqueid: 3 } } }),
}));

vi.mock('@/entities/User', () => ({
  selectCurrentUser: (s: { auth: { user: { uniqueid: number } } }) => s.auth.user,
}));

vi.mock('@/features/conferences/lib/useConferenceSse', () => ({
  useConferenceSse: vi.fn(),
}));

vi.mock('@/features/conferences/lib/ConferenceSessionProvider', () => ({
  useConferenceSessionHost: () => ({
    startMedia,
    hangup,
    sipId: 'ew101_1',
    weakLink: false,
    room: {
      status: hostStatus,
      error: hostError,
      remoteTracks: {},
      videoFailedMids: ['mid-1'],
      leave: vi.fn(),
      retryVideo: vi.fn(),
    },
  }),
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

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

import { useConferenceSse } from '@/features/conferences/lib/useConferenceSse';
import { ConferenceRoomPage } from './ConferenceRoomPage';

describe('ConferenceRoomPage (16.3-09 G-16.3-1)', () => {
  beforeEach(() => {
    startMedia.mockClear();
    hangup.mockClear();
    hostStatus = 'idle';
    hostError = null;
  });

  it('keeps the orchestrator at 70 lines or fewer and does not own useConferenceRoom', () => {
    const source = readFileSync(resolve(here, './ConferenceRoomPage.tsx'), 'utf8');
    expect(source.split(/\r?\n/).length).toBeLessThanOrEqual(70);
    expect(source).toMatch(/useConferenceSessionHost/);
    expect(source).not.toMatch(/useConferenceRoom\s*\(/);
    expect(source).toMatch(/videoFailedMids=\{host\.room\.videoFailedMids\}/);
    expect(source).toMatch(/onRetryVideo=\{host\.room\.retryVideo\}/);
    expect(source).toMatch(/weakLink=\{host\.weakLink\}/);
    expect(source).toMatch(/useConferenceSse\(\{\s*mode:\s*'staff'/);
    expect(source).not.toMatch(/dispatch\(leaveSession\(\)\)/);
    expect(source).not.toMatch(/roomHook\.leave/);
    expect(source).toMatch(/onEnd=\{\(\) => \{ void host\.hangup\(\); \}\}/);
  });

  it('renders the three LiveRoom zones', () => {
    render(<ConferenceRoomPage />);
    expect(screen.getByTestId('conference-room-page')).toBeInTheDocument();
    expect(screen.getByTestId('live-room-header')).toBeInTheDocument();
    expect(screen.getByTestId('live-room-stage')).toBeInTheDocument();
    expect(screen.getByTestId('room-control-bar')).toBeInTheDocument();
    expect(screen.getByText('8001')).toBeInTheDocument();
    expect(screen.queryByText(/tenant/i)).not.toBeInTheDocument();
    expect(useConferenceSse).toHaveBeenCalledWith({ mode: 'staff', roomUid: 7 });
  });

  it('calls startMedia on Join and hangup on Leave', async () => {
    const user = userEvent.setup();
    render(<ConferenceRoomPage />);
    await user.click(screen.getByRole('button', { name: 'Войти в конференцию' }));
    expect(startMedia).toHaveBeenCalledWith(expect.objectContaining({
      roomUid: 7,
      roomNumber: '8001',
      name: 'Standup',
      role: 'participant',
      sipId: 'ew101_1',
    }));

    await user.click(screen.getByRole('button', { name: 'Выйти из конференции' }));
    expect(hangup).toHaveBeenCalled();
  });

  it('does not start the UA when there is no WebRTC companion', () => {
    hostError = 'noWebrtcCompanion';
    hostStatus = 'error';
    render(<ConferenceRoomPage />);
    expect(screen.getByText(/нет WebRTC-абонента/)).toBeInTheDocument();
    expect(startMedia).not.toHaveBeenCalled();
  });

  it('does not hang up when the room page unmounts', () => {
    const source = readFileSync(resolve(here, './ConferenceRoomPage.tsx'), 'utf8');
    expect(source).not.toMatch(/useEffect\(\(\) => \(\) => \{[^;]*leaveSession/);
    const { unmount } = render(<ConferenceRoomPage />);
    unmount();
    expect(hangup).not.toHaveBeenCalled();
  });
});
