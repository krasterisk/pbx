import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { ConferenceSessionState } from '@/features/conferences/model/slice/conferenceSessionSlice';

const here = dirname(fileURLToPath(import.meta.url));

const useIsMobileMock = vi.fn((_bp?: number) => false);
const muteParticipant = vi.fn();
const unmuteParticipant = vi.fn();
const setMeVideo = vi.fn();
const kickParticipant = vi.fn();
const dispatchMock = vi.fn();
const hangup = vi.fn(async () => undefined);
let sseStatus: 'loading' | 'open' | 'disconnected' = 'open';
let sessionState: ConferenceSessionState = idleSession();
let roomQuery: {
  data?: { uid: number; number: string; name: string; participants?: Array<{ ref: string }> };
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
} = connectedRoom();

function idleSession(): ConferenceSessionState {
  return {
    roomUid: null,
    number: null,
    name: null,
    role: null,
    startedAt: null,
    sipId: null,
  };
}

function activeSession(
  over: Partial<ConferenceSessionState> = {},
): ConferenceSessionState {
  return {
    roomUid: 9,
    number: '6001',
    name: 'Weekly planning sync with a very long title',
    role: 'participant',
    startedAt: '2026-09-16T12:00:00.000Z',
    sipId: 'ew101',
    ...over,
  };
}

function connectedRoom() {
  return {
    data: {
      uid: 9,
      number: '6001',
      name: 'Weekly planning sync with a very long title',
      participants: [{ ref: 'ew101' }, { ref: 'sip-200' }],
    },
    isFetching: false,
    isError: false,
    isSuccess: true,
  };
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallback?: string | { defaultValue?: string; count?: number },
    ) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback?.defaultValue) return fallback.defaultValue;
      if (typeof fallback?.count === 'number' && key === 'conferences.live.participantsCount') {
        return `Участников: ${fallback.count}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (
    sel: (s: { conferenceSession: ConferenceSessionState }) => unknown,
  ) => sel({ conferenceSession: sessionState }),
  useAppDispatch: () => dispatchMock,
}));

vi.mock('@/features/conferences/lib/ConferenceSessionProvider', () => ({
  useConferenceSessionHost: () => ({
    startMedia: vi.fn(),
    hangup,
    sipId: 'ew101',
    weakLink: false,
    room: {
      status: 'in-call',
      error: null,
      remoteTracks: {},
      videoFailedMids: [],
      leave: vi.fn(),
      retryVideo: vi.fn(),
    },
  }),
}));

vi.mock('@/features/conferences/lib/useConferenceSse', () => ({
  useConferenceSse: () => sseStatus,
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useGetConferenceRoomQuery: () => roomQuery,
  useMuteConferenceParticipantMutation: () => [muteParticipant, { isLoading: false }],
  useUnmuteConferenceParticipantMutation: () => [unmuteParticipant, { isLoading: false }],
  useSetConferenceMeVideoMutation: () => [setMeVideo, { isLoading: false }],
  useKickConferenceParticipantMutation: () => [kickParticipant, { isLoading: false }],
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { ConferenceMiniPanel } from './ConferenceMiniPanel';

function renderPanel(path = '/conferences') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ConferenceMiniPanel />
    </MemoryRouter>,
  );
}

describe('ConferenceMiniPanel (16.3-06 D-26 / D-29)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hangup.mockClear();
    useIsMobileMock.mockReturnValue(false);
    sseStatus = 'open';
    sessionState = activeSession();
    roomQuery = connectedRoom();
    muteParticipant.mockReturnValue({ unwrap: () => Promise.resolve() });
    unmuteParticipant.mockReturnValue({ unwrap: () => Promise.resolve() });
    setMeVideo.mockReturnValue({ unwrap: () => Promise.resolve() });
    kickParticipant.mockReturnValue({ unwrap: () => Promise.resolve() });
  });

  it('renders nothing without a conference session', () => {
    sessionState = idleSession();
    renderPanel('/endpoints');
    expect(screen.queryByTestId('conference-mini-trigger')).toBeNull();
    expect(screen.queryByTestId('conference-mini-sticky')).toBeNull();
    expect(screen.queryByTestId('conference-mini-chrome')).toBeNull();
  });

  it('renders nothing on /conferences/:uid/room even with a session', () => {
    renderPanel('/conferences/9/room');
    expect(screen.queryByTestId('conference-mini-trigger')).toBeNull();
    expect(screen.queryByTestId('conference-mini-sticky')).toBeNull();
  });

  it('shows a 44×44 desktop chrome trigger with mini.inConference and aria-expanded', async () => {
    const user = userEvent.setup();
    renderPanel('/conferences');

    const trigger = screen.getByTestId('conference-mini-trigger');
    expect(trigger).toHaveAttribute('aria-label', 'Вы в конференции');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'conference-mini-panel');
    expect(trigger).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
    expect(screen.getByTestId('conference-mini-chrome')).toBeInTheDocument();
    expect(screen.queryByTestId('conference-mini-sticky')).toBeNull();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('conference-mini-panel')).toBeInTheDocument();
    expect(screen.getByTestId('conference-mini-name')).toHaveTextContent(
      'Weekly planning sync with a very long title',
    );
    expect(screen.getByTestId('conference-mini-number')).toHaveTextContent('6001');
    expect(screen.getByTestId('conference-mini-number').textContent).not.toContain('9');
    expect(screen.getByRole('button', { name: 'Открыть комнату' })).toBeInTheDocument();
  });

  it('uses a separate phone sticky bar above the 72px softphone, not a scaled chrome trigger', () => {
    useIsMobileMock.mockReturnValue(true);
    renderPanel('/conferences');

    expect(screen.getByTestId('conference-mini-sticky')).toBeInTheDocument();
    expect(screen.queryByTestId('conference-mini-chrome')).toBeNull();
    expect(screen.queryByTestId('conference-mini-trigger')).toBeNull();

    const mic = screen.getByRole('button', { name: 'Выключить микрофон' });
    expect(mic.querySelector('span')).toBeNull();
    expect(mic).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
    expect(screen.getByRole('button', { name: 'Открыть комнату' })).toHaveStyle({
      minWidth: '44px',
      minHeight: '44px',
    });
  });

  it('keeps the timer at 0:00, hides the count, shows a warning dot and disables mic/cam while SSE is loading', async () => {
    const user = userEvent.setup();
    sseStatus = 'loading';
    roomQuery = { data: undefined, isFetching: true, isError: false, isSuccess: false };
    renderPanel('/endpoints');

    expect(screen.getByTestId('conference-mini-dot')).toHaveAttribute('data-state', 'warning');
    await user.click(screen.getByTestId('conference-mini-trigger'));
    expect(screen.getByTestId('conference-mini-timer')).toHaveTextContent('0:00');
    expect(screen.queryByTestId('conference-mini-count')).toBeNull();
    expect(screen.getByRole('button', { name: 'Выключить микрофон' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Выключить камеру' })).toBeDisabled();
  });

  it('shows a destructive dot and keeps the open CTA when SSE is disconnected', async () => {
    const user = userEvent.setup();
    sseStatus = 'disconnected';
    renderPanel('/conferences');

    expect(screen.getByTestId('conference-mini-dot')).toHaveAttribute('data-state', 'destructive');
    expect(toast.error).toHaveBeenCalled();

    await user.click(screen.getByTestId('conference-mini-trigger'));
    expect(screen.getByRole('button', { name: 'Открыть комнату' })).toBeInTheDocument();
    expect(screen.getByTestId('conference-mini-panel')).toBeInTheDocument();
  });

  it('mutes and leaves through the same JWT participant endpoints as LiveRoom', async () => {
    const user = userEvent.setup();
    renderPanel('/conferences');
    await user.click(screen.getByTestId('conference-mini-trigger'));

    await user.click(screen.getByRole('button', { name: 'Выключить микрофон' }));
    expect(muteParticipant).toHaveBeenCalledWith({ roomUid: 9, ref: 'ew101' });

    await user.click(screen.getByRole('button', { name: 'Выйти из конференции' }));
    expect(kickParticipant).toHaveBeenCalledWith({ roomUid: 9, ref: 'ew101' });
    expect(hangup).toHaveBeenCalled();
  });

  it('opens the room without hanging up', async () => {
    const user = userEvent.setup();
    renderPanel('/conferences');
    await user.click(screen.getByTestId('conference-mini-trigger'));
    await user.click(screen.getByRole('button', { name: 'Открыть комнату' }));
    expect(hangup).not.toHaveBeenCalled();
  });

  it('copies softphone chrome geometry and places the phone bar at 60px + 72px + safe-area', () => {
    const scss = readFileSync(resolve(here, 'ConferenceMiniPanel.module.scss'), 'utf8');
    const source = readFileSync(resolve(here, 'ConferenceMiniPanel.tsx'), 'utf8');

    expect(scss).toMatch(/min-width:\s*44px/);
    expect(scss).toMatch(/min-height:\s*44px/);
    expect(scss).toMatch(/z-index:\s*var\(--z-index-toast\)/);
    expect(scss).toMatch(/width:\s*min\(320px,\s*calc\(100vw - 32px\)\)/);
    expect(scss).toMatch(/max-height:\s*min\(560px,\s*calc\(100vh - 96px\)\)/);
    expect(scss).toMatch(/\$bottom-nav-height:\s*60px/);
    expect(scss).toMatch(/\$softphone-bar-height:\s*72px/);
    expect(scss).toMatch(
      /bottom:\s*calc\(#\{\$bottom-nav-height\} \+ #\{\$softphone-bar-height\} \+ env\(safe-area-inset-bottom/,
    );
    expect(scss).toMatch(/flex-wrap/);
    expect(scss).toMatch(/text-overflow:\s*ellipsis/);
    expect(source).toMatch(/<Text[\s>]/);
    expect(source).not.toMatch(/dangerouslySetInnerHTML/);
    expect(source).not.toMatch(/innerHTML/);
  });
});
