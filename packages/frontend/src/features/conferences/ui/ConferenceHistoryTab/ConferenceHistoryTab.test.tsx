import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConferenceHistoryTab } from './ConferenceHistoryTab';
import {
  useGetConferenceMeetingsQuery,
  type ConferenceMeeting,
} from '@/shared/api/endpoints/conferenceMeetingsApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/api/apiBase', () => ({
  getAuthApiBase: () => '/api',
}));

vi.mock('@/shared/api/endpoints/conferenceMeetingsApi', () => ({
  useGetConferenceMeetingsQuery: vi.fn(),
  conferenceMeetingPlayUrl: (
    roomUid: number,
    meetingUid: number,
    opts?: { download?: boolean },
  ) =>
    opts?.download
      ? `/conferences/${roomUid}/meetings/${meetingUid}/play?download=1`
      : `/conferences/${roomUid}/meetings/${meetingUid}/play`,
}));

vi.mock('@/shared/ui/AudioPlayer', () => ({
  AudioPlayer: ({ src }: { src: string }) => (
    <div data-testid="audio-player-inner" data-src={src} />
  ),
}));

function meeting(overrides: Partial<ConferenceMeeting> = {}): ConferenceMeeting {
  return {
    uid: 15,
    room_uid: 77,
    started_at: '2026-09-16T08:00:00.000Z',
    ended_at: '2026-09-16T08:12:00.000Z',
    has_recording: true,
    recording_file_rel: '1/conferences/77/15.wav',
    participants: [
      {
        display_name: 'Alice',
        role: 'owner',
        joined_at: '2026-09-16T08:00:00.000Z',
        left_at: null,
        caller_id_num: '101',
      },
    ],
    ...overrides,
  };
}

function renderTab(data: ConferenceMeeting[] | undefined, roomUid = 77) {
  vi.mocked(useGetConferenceMeetingsQuery).mockReturnValue({
    data,
    isFetching: false,
    isLoading: false,
  } as unknown as ReturnType<typeof useGetConferenceMeetingsQuery>);
  return render(<ConferenceHistoryTab roomUid={roomUid} />);
}

describe('ConferenceHistoryTab (16.2-04 D-33)', () => {
  beforeEach(() => {
    localStorage.setItem('accessToken', 'test-jwt');
  });

  it('renders a JWT play URL player when recording_file_rel is set', () => {
    renderTab([meeting()]);
    const player = screen.getByTestId('conference-history-player');
    const src = player.getAttribute('data-src') ?? '';
    expect(src).toContain('/conferences/77/meetings/15/play');
    expect(src).toContain('token=');
    expect(src).not.toContain('/reports/cdr/recording/');
    expect(src).not.toContain('1/conferences/77/15.wav');
  });

  it('does not render the player without recording_file_rel or has_recording', () => {
    renderTab([
      meeting({
        uid: 16,
        has_recording: false,
        recording_file_rel: null,
      }),
      meeting({
        uid: 17,
        has_recording: false,
        recording_file_rel: null,
      }),
    ]);
    expect(screen.queryByTestId('conference-history-player')).toBeNull();
  });

  it('shows a player only on the meeting that has a recording file', () => {
    renderTab([
      meeting(),
      meeting({
        uid: 16,
        has_recording: false,
        recording_file_rel: null,
      }),
    ]);
    expect(screen.getAllByTestId('conference-history-player')).toHaveLength(1);
  });

  it('shows empty copy from conferences.history.empty', () => {
    renderTab([]);
    expect(screen.getByText('Нет встреч')).toBeInTheDocument();
  });

  it('shows ASCII hyphen-minus for a meeting without ended_at', () => {
    renderTab([
      meeting({
        ended_at: null,
        has_recording: false,
        recording_file_rel: null,
      }),
    ]);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('asks meetings for the given roomUid', () => {
    renderTab([], 42);
    expect(useGetConferenceMeetingsQuery).toHaveBeenCalledWith(42);
  });

  it('lists participants after expanding a row', () => {
    renderTab([meeting()]);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
  });
});
