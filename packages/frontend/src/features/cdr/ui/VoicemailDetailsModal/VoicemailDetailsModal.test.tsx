import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IVoicemailMessage } from '@krasterisk/shared';
import { VoicemailDetailsModal } from './VoicemailDetailsModal';
import {
  useGetVoicemailByUniqueidQuery,
  useRetryVoicemailSttMutation,
} from '@/shared/api/endpoints/voicemailApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

const retryMutate = vi.fn();

vi.mock('@/shared/api/endpoints/voicemailApi', () => ({
  useGetVoicemailByUniqueidQuery: vi.fn(),
  useRetryVoicemailSttMutation: vi.fn(() => [retryMutate, { isLoading: false }]),
  voicemailPlayUrl: (uniqueid: string, opts?: { download?: boolean }) =>
    opts?.download
      ? `/voicemail/${encodeURIComponent(uniqueid)}/play?download=1`
      : `/voicemail/${encodeURIComponent(uniqueid)}/play`,
}));

vi.mock('@/shared/ui/Dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children, size }: { children: React.ReactNode; size?: string }) => (
    <div data-size={size}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/shared/ui/AudioPlayer', () => ({
  AudioPlayer: ({ src, compact }: { src: string; compact?: boolean }) => (
    <div data-testid="audio-player" data-compact={compact ? 'true' : 'false'} data-src={src} />
  ),
}));

function message(overrides: Partial<IVoicemailMessage> = {}): IVoicemailMessage {
  return {
    uid: 1,
    vpbx_user_uid: 100,
    uniqueid: '1693731234.12',
    file_rel: '100/voicemail/1693731234.12.wav',
    record_status: 'ANSWERED',
    caller_id: '79001234567',
    exten: '100',
    duration_sec: 12,
    notify_status: 'sent',
    transcript_status: 'pending',
    notify_attempts: 0,
    transcript_attempts: 0,
    next_notify_at: null,
    scan_locked_until: null,
    created_at: '2026-09-03T10:00:00Z',
    ...overrides,
  };
}

function renderModal(data: IVoicemailMessage | undefined, isFetching = false) {
  vi.mocked(useGetVoicemailByUniqueidQuery).mockReturnValue({
    data,
    isFetching,
    isLoading: isFetching && !data,
  } as ReturnType<typeof useGetVoicemailByUniqueidQuery>);
  return render(
    <VoicemailDetailsModal uniqueid="1693731234.12" isOpen onClose={vi.fn()} />,
  );
}

describe('VoicemailDetailsModal (Surface L / D-58 / D-69)', () => {
  beforeEach(() => {
    retryMutate.mockReset();
    vi.mocked(useRetryVoicemailSttMutation).mockReturnValue([
      retryMutate,
      { isLoading: false },
    ] as unknown as ReturnType<typeof useRetryVoicemailSttMutation>);
  });

  it('renders a large Dialog, not a Sheet', () => {
    renderModal(message());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.querySelector('[data-size="large"]')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')?.closest('[data-sheet]')).toBeNull();
  });

  it('pending shows SkeletonText and preparing copy', () => {
    renderModal(message({ transcript_status: 'pending' }));
    expect(screen.getByText('Расшифровка готовится')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="audio-player"]')).toBeInTheDocument();
  });

  it('ready shows summary and full transcript', () => {
    renderModal(message({
      transcript_status: 'ready',
      summary: 'Клиент просил перезвонить',
      transcript: 'Полный текст расшифровки сообщения',
    }));
    expect(screen.getByText('Клиент просил перезвонить')).toBeInTheDocument();
    expect(screen.getByText('Полный текст расшифровки сообщения')).toBeInTheDocument();
  });

  it('done is treated as ready and shows transcript', () => {
    renderModal(message({
      transcript_status: 'done' as IVoicemailMessage['transcript_status'],
      summary: 'Кратко',
      transcript: 'Готовая расшифровка',
    }));
    expect(screen.getByText('Кратко')).toBeInTheDocument();
    expect(screen.getByText('Готовая расшифровка')).toBeInTheDocument();
  });

  it('failed shows destructive copy and retry calls retry-stt', () => {
    renderModal(message({ transcript_status: 'failed' }));
    const retry = screen.getByRole('button', { name: 'Повторить расшифровку' });
    fireEvent.click(retry);
    expect(retryMutate).toHaveBeenCalledWith('1693731234.12');
  });

  it('not_configured has STT settings link and no retry button', () => {
    renderModal(message({ transcript_status: 'not_configured' }));
    expect(screen.getByRole('link', { name: /настройки STT/i })).toHaveAttribute(
      'href',
      '/settings/stt-engines',
    );
    expect(screen.queryByRole('button', { name: 'Повторить расшифровку' })).not.toBeInTheDocument();
  });

  it('notify_status=failed is a meta line, not a toast or alert', () => {
    renderModal(message({ notify_status: 'failed' }));
    expect(screen.getByText(/уведомление/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /toast/i })).not.toBeInTheDocument();
  });

  it('does not render a notify token URL or compact AudioPlayer', () => {
    renderModal(message({ transcript_status: 'ready', transcript: 'ok' }));
    expect(document.body.textContent).not.toMatch(/\/voicemail\/play\?token=/);
    expect(document.body.textContent).not.toMatch(/скопировать ссылку/i);
    const player = screen.getByTestId('audio-player');
    expect(player).toHaveAttribute('data-compact', 'false');
    expect(player.getAttribute('data-src')).toMatch(/\/voicemail\/1693731234\.12\/play/);
    expect(player.getAttribute('data-src')).not.toMatch(/\/voicemail\/play\?token=/);
  });
});
