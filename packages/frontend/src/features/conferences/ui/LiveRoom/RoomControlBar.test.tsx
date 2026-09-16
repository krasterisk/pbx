import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { toast } from 'react-toastify';
import { RoomControlBar } from './RoomControlBar';

const here = dirname(fileURLToPath(import.meta.url));

const useIsMobileMock = vi.fn((_bp?: number) => false);
const startRecording = vi.fn();
const stopRecording = vi.fn();
const inviteConference = vi.fn();
let recordingPending = false;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string; name?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback?.defaultValue) return fallback.defaultValue;
      return key;
    },
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/shared/api/endpoints/conferenceMeetingsApi', () => ({
  useStartConferenceRecordingMutation: () => [startRecording, { isPending: recordingPending }],
  useStopConferenceRecordingMutation: () => [stopRecording, { isPending: recordingPending }],
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useInviteConferenceMutation: () => [inviteConference, { isPending: false }],
}));

function renderBar(
  overrides: Partial<ComponentProps<typeof RoomControlBar>> = {},
) {
  return render(
    <RoomControlBar
      roomUid={7}
      role="owner"
      inviteExternalScope="moderator"
      canRecord
      isMuted={false}
      isCameraOff={false}
      isRecording={false}
      onMicToggle={vi.fn()}
      onCamToggle={vi.fn()}
      onLeave={vi.fn()}
      onEnd={vi.fn()}
      {...overrides}
    />,
  );
}

describe('RoomControlBar (16.3-05 D-29 / D-31)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockImplementation((bp?: number) => (bp ?? 768) > 1200);
    recordingPending = false;
    startRecording.mockReturnValue({ unwrap: () => Promise.resolve() });
    stopRecording.mockReturnValue({ unwrap: () => Promise.resolve() });
    inviteConference.mockReturnValue({ unwrap: () => Promise.resolve() });
  });

  it('uses the same live.* key for title and aria-label and sizes icon controls to 44px', () => {
    renderBar();
    const mic = screen.getByRole('button', { name: 'Выключить микрофон' });
    expect(mic).toHaveAttribute('title', 'Выключить микрофон');
    expect(mic).toHaveAttribute('aria-label', 'Выключить микрофон');
    expect(mic).toHaveStyle({ minWidth: '44px', minHeight: '44px' });

    const source = readFileSync(resolve(here, 'RoomControlBar.tsx'), 'utf8');
    expect(source).not.toMatch(/className=["']w-4 h-4["']/);
    expect(source).toMatch(/size=["']icon["']/);
  });

  it('hides captions at 360px and keeps every control at least 44px with wrap', () => {
    useIsMobileMock.mockImplementation((bp?: number) => (bp ?? 768) >= 768);
    renderBar();

    const mic = screen.getByRole('button', { name: 'Выключить микрофон' });
    expect(mic.querySelector('span')).toBeNull();
    const buttons = screen.getAllByRole('button').filter((el) => el.getAttribute('aria-label'));
    buttons.forEach((btn) => {
      expect(btn).toHaveStyle({ minWidth: '44px', minHeight: '44px' });
    });

    const scss = readFileSync(resolve(here, 'RoomControlBar.module.scss'), 'utf8');
    expect(scss).toMatch(/flex-wrap/);
    expect(scss).toMatch(/min-width:\s*44px/);
    expect(scss).toMatch(/min-height:\s*44px/);
    expect(scss).toMatch(/ring-inset|inset/);
  });

  it('disables the record button while pending and does not optimistic-patch recording', async () => {
    recordingPending = true;
    const user = userEvent.setup();
    renderBar({ isRecording: false });

    const record = screen.getByRole('button', { name: 'Начать запись' });
    expect(record).toBeDisabled();
    expect(record.querySelector('svg.lucide-loader-circle, svg.lucide-loader-2, [data-pending]')).toBeTruthy();

    await user.click(record);
    expect(startRecording).not.toHaveBeenCalled();
    expect(stopRecording).not.toHaveBeenCalled();

    const source = readFileSync(resolve(here, 'RoomControlBar.tsx'), 'utf8');
    expect(source).not.toMatch(/updateQueryData/);
    expect(source).toMatch(/isPending/);
  });

  it('shows inviteMember for owner/moderator and inviteExternal only when scope allows', () => {
    const { rerender } = renderBar({ role: 'owner', inviteExternalScope: 'owner' });
    expect(screen.getByRole('button', { name: 'Пригласить абонента' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Пригласить внешний номер' })).toBeInTheDocument();

    rerender(
      <RoomControlBar
        roomUid={7}
        role="moderator"
        inviteExternalScope="owner"
        canRecord
        isMuted={false}
        isCameraOff={false}
        isRecording={false}
        onMicToggle={vi.fn()}
        onCamToggle={vi.fn()}
        onLeave={vi.fn()}
        onEnd={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Пригласить абонента' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Пригласить внешний номер' })).not.toBeInTheDocument();

    rerender(
      <RoomControlBar
        roomUid={7}
        role="participant"
        inviteExternalScope="anyone"
        canRecord={false}
        isMuted={false}
        isCameraOff={false}
        isRecording={false}
        onMicToggle={vi.fn()}
        onCamToggle={vi.fn()}
        onLeave={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Пригласить абонента' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Пригласить внешний номер' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Завершить конференцию' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выйти из конференции' })).toBeInTheDocument();
  });

  it('maps invite 403 to inviteExternalForbidden and success to inviteSent', async () => {
    const user = userEvent.setup();
    inviteConference.mockReturnValue({
      unwrap: () => Promise.reject({ status: 403 }),
    });
    renderBar({ role: 'owner', inviteExternalScope: 'anyone' });

    await user.click(screen.getByRole('button', { name: 'Пригласить внешний номер' }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('heading', { name: 'Пригласить внешний номер' })).toBeInTheDocument();

    const input = within(sheet).getByRole('textbox');
    await user.type(input, '79001234567');
    await user.click(within(sheet).getByRole('button', { name: 'Пригласить внешний номер' }));

    expect(inviteConference).toHaveBeenCalledWith({
      uid: 7,
      data: { kind: 'external', target: '79001234567' },
    });
    expect(toast.error).toHaveBeenCalledWith(
      'У вас нет права приглашать внешние номера в этой комнате.',
    );

    inviteConference.mockReturnValue({ unwrap: () => Promise.resolve() });
    await user.clear(input);
    await user.type(input, '101');
    await user.click(within(sheet).getByRole('button', { name: 'Пригласить внешний номер' }));
    expect(toast.success).toHaveBeenCalledWith('Звоним участнику');
  });

  it('always shows leave and opens the end dialog with Keep / Confirm pairs', async () => {
    const user = userEvent.setup();
    const onEnd = vi.fn();
    renderBar({ onEnd });

    expect(screen.getByRole('button', { name: 'Выйти из конференции' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Завершить конференцию' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Завершить конференцию для всех?')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Продолжить встречу' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Завершить конференцию' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Завершить конференцию' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
