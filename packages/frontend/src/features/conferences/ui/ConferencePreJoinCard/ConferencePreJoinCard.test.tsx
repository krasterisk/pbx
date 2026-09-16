import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const here = dirname(fileURLToPath(import.meta.url));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _key),
  }),
}));

vi.mock('@/features/callcenter/lib/useAudioDevices', () => ({
  useAudioDevices: () => ({
    microphones: [
      { deviceId: 'mic1', label: 'Mic 1', kind: 'audioinput', groupId: '', toJSON: () => ({}) },
    ],
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

import { ConferencePreJoinCard } from './ConferencePreJoinCard';

const JOIN = 'Присоединиться к конференции';

describe('ConferencePreJoinCard (16.3-07 D-28/D-29)', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        enumerateDevices: vi.fn().mockResolvedValue([
          { deviceId: 'cam1', label: 'Cam 1', kind: 'videoinput', groupId: '' },
        ]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  it('renders a 480px card with guest.join CTA and device selects', () => {
    render(<ConferencePreJoinCard onJoin={vi.fn()} />);
    expect(screen.getByRole('button', { name: JOIN })).toBeInTheDocument();
    expect(screen.getByLabelText('Микрофон')).toBeInTheDocument();
    expect(screen.getByLabelText('Камера')).toBeInTheDocument();
    const scss = readFileSync(resolve(here, './ConferencePreJoinCard.module.scss'), 'utf8');
    expect(scss).toMatch(/max-width:\s*480px/);
    expect(scss).toMatch(/min-height:\s*48px/);
    expect(scss).not.toMatch(/@media[^{]+\{[^}]*display:\s*none/);
  });

  it('hides the PIN field unless room policy requires it', () => {
    const { rerender } = render(<ConferencePreJoinCard onJoin={vi.fn()} />);
    expect(screen.queryByLabelText('PIN комнаты')).not.toBeInTheDocument();
    rerender(<ConferencePreJoinCard requiresPin onJoin={vi.fn()} />);
    expect(screen.getByLabelText('PIN комнаты')).toBeInTheDocument();
  });

  it('shows the PIN field when the join error code is CONFERENCE_PIN_REQUIRED', () => {
    render(
      <ConferencePreJoinCard
        onJoin={vi.fn()}
        error={{ status: 400, data: { code: 'CONFERENCE_PIN_REQUIRED', message: 'raw pin required' } }}
      />,
    );
    expect(screen.getByLabelText('PIN комнаты')).toBeInTheDocument();
    expect(screen.queryByText('raw pin required')).not.toBeInTheDocument();
  });

  it('marks the PIN field invalid with aria-describedby on CONFERENCE_PIN_WRONG', () => {
    render(
      <ConferencePreJoinCard
        requiresPin
        onJoin={vi.fn()}
        error={{ status: 400, data: { code: 'CONFERENCE_PIN_WRONG', message: 'server said nope' } }}
      />,
    );
    const pin = screen.getByLabelText('PIN комнаты');
    expect(pin).toHaveAttribute('aria-invalid', 'true');
    const describedBy = pin.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Неверный PIN комнаты');
    expect(screen.queryByText('server said nope')).not.toBeInTheDocument();
  });

  it('shows live.full without an enter-without-video control on CONFERENCE_ROOM_FULL', () => {
    render(
      <ConferencePreJoinCard
        onJoin={vi.fn()}
        error={{ status: 409, data: { code: 'CONFERENCE_ROOM_FULL', message: 'room packed' } }}
      />,
    );
    expect(screen.getByText('В комнате нет свободных мест')).toBeInTheDocument();
    expect(screen.getByText(/Попробуйте подключиться позже/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /без видео/i })).not.toBeInTheDocument();
    expect(screen.queryByText('room packed')).not.toBeInTheDocument();
  });

  it.each([
    'CONFERENCE_GUEST_TOKEN_REVOKED',
    'CONFERENCE_GUEST_TOKEN_EXPIRED',
    'CONFERENCE_GUEST_TOKEN_INVALID',
  ])('renders one guest.linkInvalid screen for 401 %s', (code) => {
    render(
      <ConferencePreJoinCard
        onJoin={vi.fn()}
        error={{ status: 401, data: { code, message: `raw ${code}` } }}
      />,
    );
    expect(screen.getByText('Ссылка недействительна или истекла')).toBeInTheDocument();
    expect(screen.queryByText(`raw ${code}`)).not.toBeInTheDocument();
    expect(screen.queryByText(/revoked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/expired/i)).not.toBeInTheDocument();
  });

  it('shows live.mediaDenied when the camera/mic permission is denied', () => {
    render(<ConferencePreJoinCard mediaDenied onJoin={vi.fn()} />);
    expect(screen.getByText('Браузер не дал доступ к микрофону')).toBeInTheDocument();
  });

  it('shows Avatar + live.camOff when the preview has no camera track', () => {
    render(<ConferencePreJoinCard onJoin={vi.fn()} />);
    expect(screen.getByText('Камера выключена')).toBeInTheDocument();
  });

  it('does not fire a second join while the first submit is pending', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<ConferencePreJoinCard joining onJoin={onJoin} />);
    const cta = screen.getByRole('button', { name: JOIN });
    expect(cta).toBeDisabled();
    await user.click(cta);
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('requires a display name before calling onJoin', async () => {
    const user = userEvent.setup();
    const onJoin = vi.fn();
    render(<ConferencePreJoinCard onJoin={onJoin} />);
    await user.click(screen.getByRole('button', { name: JOIN }));
    expect(onJoin).not.toHaveBeenCalled();
    expect(screen.getByText('Укажите имя')).toBeInTheDocument();
  });

  it('shows lobby copy with a disabled CTA while waiting for the moderator', () => {
    render(<ConferencePreJoinCard waitingForModerator onJoin={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('Ждём одобрения модератора')).toBeInTheDocument();
    expect(screen.getByText(/Не закрывайте страницу/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: JOIN })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Покинуть конференцию' })).toBeInTheDocument();
  });
});
