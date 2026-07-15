import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CallGroupFormModal } from './CallGroupFormModal';
import * as callGroupApiHooks from '@/shared/api/endpoints/callGroupApi';
import * as contextApiHooks from '@/shared/api/endpoints/contextApi';
import type { RootState } from '@/app/store/store';

const mockDispatch = vi.fn();
const mockCreate = vi.fn(() => ({ unwrap: () => Promise.resolve({ uid: 1 }) }));

const baseState: Partial<RootState> = {
  callGroupsPage: {
    isModalOpen: true,
    modalMode: 'create',
    selectedCallGroupUid: null,
  },
  auth: {
    user: { vpbx_user_uid: 42 } as any,
    token: 'test',
    isAuthenticated: true,
  } as any,
};

let mockState: Partial<RootState> = { ...baseState };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: RootState) => unknown) => selector(mockState as RootState),
}));

vi.mock('@/shared/api/endpoints/callGroupApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetCallGroupQuery: vi.fn(),
    useCreateCallGroupMutation: vi.fn(),
    useUpdateCallGroupMutation: vi.fn(),
  };
});

vi.mock('@/shared/api/endpoints/contextApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetContextsQuery: vi.fn(),
  };
});

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/ui')>();
  return {
    ...actual,
    Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
      (open ? <div data-testid="dialog">{children}</div> : null),
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

const mockContexts = [
  { uid: 1, name: 'ctx-42', comment: '', user_uid: 1 },
  { uid: 2, name: 'from-internal', comment: '', user_uid: 1 },
];

describe('CallGroupFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState = { ...baseState };
    (callGroupApiHooks.useGetCallGroupQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isFetching: false,
    });
    (callGroupApiHooks.useCreateCallGroupMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      mockCreate,
      { isLoading: false },
    ]);
    (callGroupApiHooks.useUpdateCallGroupMutation as ReturnType<typeof vi.fn>).mockReturnValue([
      vi.fn(),
      { isLoading: false },
    ]);
    (contextApiHooks.useGetContextsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockContexts,
    });
  });

  it('renders all four strategy options', () => {
    render(<CallGroupFormModal />);

    const strategySelect = screen.getByLabelText('Стратегия') as HTMLSelectElement;
    const options = Array.from(strategySelect.options).map((o) => o.value);

    expect(options).toEqual(['ringall', 'hunt', 'memoryhunt', 'random']);
  });

  it('adds a member, sets member_type and ring_time, reorders, and submits with position-indexed members', async () => {
    render(<CallGroupFormModal />);

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Sales ring' } });

    const addRow = screen.getByPlaceholderText('Номер / добавочный').closest('div') as HTMLElement;
    const addTypeSelect = within(addRow).getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(addTypeSelect, { target: { value: 'external' } });
    fireEvent.change(screen.getByPlaceholderText('Номер / добавочный'), { target: { value: '101' } });
    fireEvent.change(screen.getByPlaceholderText('Время звонка (сек)'), { target: { value: '15' } });
    fireEvent.click(screen.getByText('Добавить участника'));

    fireEvent.change(addTypeSelect, { target: { value: 'internal' } });
    const valueInputs = screen.getAllByPlaceholderText('Номер / добавочный');
    fireEvent.change(valueInputs[valueInputs.length - 1], { target: { value: '202' } });
    fireEvent.click(screen.getByText('Добавить участника'));

    const memberRows = screen.getAllByText('1');
    expect(memberRows.length).toBeGreaterThan(0);

    const moveDownButtons = screen.getAllByTitle('Вниз');
    fireEvent.click(moveDownButtons[0]);

    fireEvent.click(screen.getByText('Сохранить'));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const payload = mockCreate.mock.calls[0][0];
    expect(payload.name).toBe('Sales ring');
    expect(payload.members).toHaveLength(2);
    expect(payload.members[0]).toMatchObject({
      member_type: 'internal',
      value: '202',
      position: 0,
    });
    expect(payload.members[1]).toMatchObject({
      member_type: 'external',
      value: '101',
      position: 1,
      ring_time: 15,
    });
  });
});
