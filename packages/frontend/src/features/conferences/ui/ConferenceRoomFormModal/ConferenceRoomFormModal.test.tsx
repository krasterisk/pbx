import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ConferenceRoomFormModal } from './ConferenceRoomFormModal';
import type { RootState } from '@/app/store/store';

const mockDispatch = vi.fn();

const sampleRoom = {
  uid: 7,
  number: '8001',
  name: 'Sales standup',
  kind: 'ephemeral',
  entry_strictness: 'token_name_pin',
  pin: '1234',
  wait_marked: true,
  end_marked: true,
  record_mode: 'auto',
  notify_recording: true,
  invite_external_scope: 'moderator',
  musiconhold: 'default',
  announce_join_leave: true,
};

let mockState: Pick<RootState, 'conferencesPage'> = {
  conferencesPage: {
    isModalOpen: true,
    modalMode: 'create',
    selectedConferenceUid: null,
  },
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: string | { count?: number; name?: string }) => {
      if (typeof opts === 'string') return opts;
      if (opts?.name) return `${key}:${opts.name}`;
      if (opts?.count != null) return `${key}:${opts.count}`;
      return key;
    },
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: RootState) => unknown) => selector(mockState as RootState),
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useGetConferenceRoomQuery: vi.fn(),
  useCreateConferenceRoomMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useUpdateConferenceRoomMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useGetConferenceCapacityQuery: vi.fn(),
  useGetConferenceGuestTokensQuery: vi.fn(),
  useCreateConferenceGuestTokenMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useRevokeConferenceGuestTokenMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
  useGetConferenceModeratorsQuery: vi.fn(),
  useSetConferenceModeratorsMutation: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/shared/api/endpoints/mohApi', () => ({
  useGetMohClassesQuery: vi.fn(() => ({ data: [] })),
}));

vi.mock('../ConferenceHistoryTab', () => ({
  ConferenceHistoryTab: ({ roomUid }: { roomUid: number }) => (
    <div data-testid="conference-history-tab" data-room-uid={String(roomUid)} />
  ),
}));

import {
  useGetConferenceRoomQuery,
  useGetConferenceCapacityQuery,
  useGetConferenceGuestTokensQuery,
  useGetConferenceModeratorsQuery,
} from '@/shared/api/endpoints/conferenceRoomApi';

function setMode(mode: 'create' | 'edit' | 'copy', uid: number | null = mode === 'create' ? null : 7) {
  mockState = {
    conferencesPage: {
      isModalOpen: true,
      modalMode: mode,
      selectedConferenceUid: uid,
    },
  };
}

describe('ConferenceRoomFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMode('create');
    vi.mocked(useGetConferenceRoomQuery).mockReturnValue({
      data: undefined,
      isFetching: false,
    } as ReturnType<typeof useGetConferenceRoomQuery>);
    vi.mocked(useGetConferenceCapacityQuery).mockReturnValue({
      data: { maxParticipants: 0 },
      isFetching: false,
    } as ReturnType<typeof useGetConferenceCapacityQuery>);
    vi.mocked(useGetConferenceGuestTokensQuery).mockReturnValue({
      data: [],
      isFetching: false,
    } as ReturnType<typeof useGetConferenceGuestTokensQuery>);
    vi.mocked(useGetConferenceModeratorsQuery).mockReturnValue({
      data: [],
      isFetching: false,
    } as ReturnType<typeof useGetConferenceModeratorsQuery>);
  });

  it('shows four tabs in create and no History or Links', () => {
    render(<ConferenceRoomFormModal />);
    expect(screen.getByRole('tab', { name: 'Основные' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Доступ' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Роли' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Запись' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Ссылки' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'История встреч' })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('shows six tabs in edit and mounts ConferenceHistoryTab with roomUid', async () => {
    setMode('edit', 7);
    vi.mocked(useGetConferenceRoomQuery).mockReturnValue({
      data: sampleRoom,
      isFetching: false,
    } as ReturnType<typeof useGetConferenceRoomQuery>);
    const user = userEvent.setup();
    render(<ConferenceRoomFormModal />);

    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByRole('tab', { name: 'Ссылки' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'История встреч' }));
    const history = screen.getByTestId('conference-history-tab');
    expect(history).toHaveAttribute('data-room-uid', '7');
  });

  it('clears number and name in copy mode and keeps other fields', async () => {
    setMode('copy', 7);
    vi.mocked(useGetConferenceRoomQuery).mockReturnValue({
      data: sampleRoom,
      isFetching: false,
    } as ReturnType<typeof useGetConferenceRoomQuery>);
    const user = userEvent.setup();
    render(<ConferenceRoomFormModal />);

    const number = screen.getByLabelText('Номер комнаты') as HTMLInputElement;
    const name = screen.getByLabelText('Название') as HTMLInputElement;
    expect(number.value).toBe('');
    expect(name.value).toBe('');
    await user.click(screen.getByRole('tab', { name: 'Доступ' }));
    expect((screen.getByLabelText('PIN комнаты') as HTMLInputElement).value).toBe('1234');
  });

  it('renders capacity as maxMembers text, including count 0, never Progress', () => {
    render(<ConferenceRoomFormModal />);
    expect(screen.getByText('conferences.maxMembers:0')).toBeInTheDocument();
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('shows empty links copy and revoke dialog in edit', async () => {
    setMode('edit', 7);
    vi.mocked(useGetConferenceRoomQuery).mockReturnValue({
      data: sampleRoom,
      isFetching: false,
    } as ReturnType<typeof useGetConferenceRoomQuery>);
    vi.mocked(useGetConferenceGuestTokensQuery).mockReturnValue({
      data: [
        {
          uid: 3,
          room_uid: 7,
          token: 'abc',
          kind: 'named_invite',
          invite_name: 'Guest Ann',
          expires_at: null,
        },
      ],
      isFetching: false,
    } as ReturnType<typeof useGetConferenceGuestTokensQuery>);
    const user = userEvent.setup();
    render(<ConferenceRoomFormModal />);

    await user.click(screen.getByRole('tab', { name: 'Ссылки' }));
    await user.click(screen.getByRole('button', { name: 'conferences.links.revoke' }));
    expect(screen.getByText('conferences.links.confirmRevoke:Guest Ann')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'conferences.links.confirmRevokeKeep' })).toBeInTheDocument();
  });

  it('shows noLinks empty state when the room has no invitations', async () => {
    setMode('edit', 7);
    vi.mocked(useGetConferenceRoomQuery).mockReturnValue({
      data: sampleRoom,
      isFetching: false,
    } as ReturnType<typeof useGetConferenceRoomQuery>);
    const user = userEvent.setup();
    render(<ConferenceRoomFormModal />);
    await user.click(screen.getByRole('tab', { name: 'Ссылки' }));
    expect(screen.getByText('conferences.links.noLinks')).toBeInTheDocument();
    expect(screen.getByText('conferences.links.noLinksHint')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'conferences.links.create' })).toBeInTheDocument();
  });

  it('does not rename conferences.history.empty', () => {
    const ru = readFileSync(resolve(__dirname, '../../../../shared/config/locales/ru.ts'), 'utf8');
    const en = readFileSync(resolve(__dirname, '../../../../shared/config/locales/en.ts'), 'utf8');
    expect(ru).toContain("empty: 'Нет встреч'");
    expect(en).toContain("empty: 'No meetings'");
  });
});
