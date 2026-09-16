import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConferenceRecordingModal } from './ConferenceRecordingModal';
import { useGetConferenceRecordingsByUniqueidQuery } from '@/shared/api/endpoints/conferenceMeetingsApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/api/apiBase', () => ({
  getAuthApiBase: () => '/api',
}));

vi.mock('@/shared/api/endpoints/conferenceMeetingsApi', () => ({
  useGetConferenceRecordingsByUniqueidQuery: vi.fn(),
  conferenceMeetingPlayUrl: (
    roomUid: number,
    meetingUid: number,
    opts?: { download?: boolean },
  ) =>
    opts?.download
      ? `/conferences/${roomUid}/meetings/${meetingUid}/play?download=1`
      : `/conferences/${roomUid}/meetings/${meetingUid}/play`,
}));

vi.mock('@/shared/ui/Dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children, size }: { children: React.ReactNode; size?: string }) => (
    <div data-size={size}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/shared/ui/AudioPlayer', () => ({
  AudioPlayer: ({ src }: { src: string }) => (
    <div data-testid="audio-player" data-src={src} />
  ),
}));

function renderModal(uniqueid: string | null = 'cid-1', isOpen = true) {
  return render(
    <ConferenceRecordingModal uniqueid={uniqueid} isOpen={isOpen} onClose={vi.fn()} />,
  );
}

describe('ConferenceRecordingModal (16.2-03 D-33 / D-30)', () => {
  beforeEach(() => {
    localStorage.setItem('accessToken', 'test-jwt');
    vi.mocked(useGetConferenceRecordingsByUniqueidQuery).mockReturnValue({
      data: [
        {
          uniqueid: 'cid-1',
          meetingUid: 15,
          roomUid: 77,
          playPath: '/conferences/77/meetings/15/play',
        },
      ],
      isFetching: false,
      isLoading: false,
    } as ReturnType<typeof useGetConferenceRecordingsByUniqueidQuery>);
  });

  it('plays the JWT conference WAV URL and never the CDR MP3 path', () => {
    renderModal();
    const player = screen.getByTestId('audio-player');
    const src = player.getAttribute('data-src') ?? '';
    expect(src).toContain('/conferences/77/meetings/15/play');
    expect(src).toContain('token=');
    expect(src).not.toContain('/reports/cdr/recording/');
  });

  it('skips the uniqueid query when closed or uniqueid is empty', () => {
    renderModal(null, true);
    expect(useGetConferenceRecordingsByUniqueidQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    );
    renderModal('cid-1', false);
    expect(useGetConferenceRecordingsByUniqueidQuery).toHaveBeenCalledWith(
      ['cid-1'],
      expect.objectContaining({ skip: true }),
    );
  });
});
