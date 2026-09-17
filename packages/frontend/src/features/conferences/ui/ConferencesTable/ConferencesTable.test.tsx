import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ConferencesTable } from './ConferencesTable';
import {
  useGetConferenceRoomsQuery,
  useDeleteConferenceRoomMutation,
} from '@/shared/api/endpoints/conferenceRoomApi';

const useIsMobileMock = vi.fn((_bp?: number) => false);
const refetch = vi.fn();
const deleteRoom = vi.fn();
const dispatch = vi.fn();

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

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: (bp?: number) => useIsMobileMock(bp),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => dispatch,
}));

vi.mock('@/shared/api/endpoints/conferenceRoomApi', () => ({
  useGetConferenceRoomsQuery: vi.fn(),
  useDeleteConferenceRoomMutation: vi.fn(),
}));

vi.mock('@/entities/conference/roleLabel', () => ({
  roleLabel: (role: string) => `role:${role}`,
}));

const sampleRoom = {
  uid: 7,
  number: '8001',
  name: 'Sales standup',
  kind: 'permanent',
  entry_strictness: 'token_name',
  record_mode: 'auto',
  participants: [{ ref: 'a', displayName: 'Ann', role: 'owner', speaking: false, muted: false, video: false }],
  recording: false,
};

function mockQuery(partial: Record<string, unknown>) {
  vi.mocked(useGetConferenceRoomsQuery).mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch,
    ...partial,
  } as ReturnType<typeof useGetConferenceRoomsQuery>);
}

describe('ConferencesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useIsMobileMock.mockReturnValue(false);
    vi.mocked(useDeleteConferenceRoomMutation).mockReturnValue([
      deleteRoom,
      { isLoading: false },
    ] as unknown as ReturnType<typeof useDeleteConferenceRoomMutation>);
    mockQuery({ data: [sampleRoom] });
  });

  it('renders overflow-x-auto hybrid marker on desktop', () => {
    render(<ConferencesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(useIsMobileMock).toHaveBeenCalledWith(768);
    expect(screen.getByText('8001')).toBeInTheDocument();
    expect(screen.getByText('Sales standup')).toBeInTheDocument();
    expect(screen.queryByText(/conf8001_7/)).toBeNull();
    const edit = screen.getByRole('button', { name: 'common.edit' });
    const copy = screen.getByRole('button', { name: 'common.copy' });
    const del = screen.getByRole('button', { name: 'common.delete' });
    expect(edit).toHaveAttribute('title', 'common.edit');
    expect(edit).toHaveAttribute('aria-label', 'common.edit');
    expect(copy).toHaveAttribute('title', 'common.copy');
    expect(del).toHaveAttribute('title', 'common.delete');
  });

  it('renders mobile-card hybrid marker when useIsMobile is true', () => {
    useIsMobileMock.mockReturnValue(true);
    render(<ConferencesTable />);
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'mobile-card');
    expect(screen.getByText('Sales standup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.edit' })).toHaveAttribute('title', 'common.edit');
    expect(screen.getByRole('button', { name: 'common.delete' })).toHaveAttribute('title', 'common.delete');
  });

  it('shows empty copy and create CTA when there are no rooms', () => {
    mockQuery({ data: [] });
    render(<ConferencesTable />);
    expect(screen.getByText('conferences.noRooms')).toBeInTheDocument();
    expect(screen.getByText('conferences.noRoomsHint')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'conferences.addRoom' })).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    mockQuery({ isLoading: true, data: undefined });
    const { container } = render(<ConferencesTable />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.innerHTML).not.toContain('animate-spin');
  });

  it('shows loadFailed and retries from retryLoad', async () => {
    mockQuery({ isError: true, isLoading: false, data: undefined });
    const user = userEvent.setup();
    render(<ConferencesTable />);
    expect(screen.getByText('conferences.loadFailed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'conferences.retryLoad' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('confirms delete with a Dialog, not window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();
    render(<ConferencesTable />);
    await user.click(screen.getByRole('button', { name: 'common.delete' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByText('conferences.confirmDelete:Sales standup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'conferences.confirmDeleteKeep' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'conferences.confirmDeleteConfirm' })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
