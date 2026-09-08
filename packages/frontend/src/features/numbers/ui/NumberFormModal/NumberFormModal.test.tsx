import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import type { RootState } from '@/app/store/store';

const mockDispatch = vi.fn();
const mockCreate = vi.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));
const mockUpdate = vi.fn(() => ({ unwrap: () => Promise.resolve({ id: 1 }) }));

const baseState: Partial<RootState> = {
  numbersPage: {
    isModalOpen: true,
    selectedNumber: null,
    modalMode: 'create',
  },
};

let mockState: Partial<RootState> = { ...baseState };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: RootState) => unknown) => selector(mockState as RootState),
}));

vi.mock('@/shared/api/api', () => ({
  useCreateNumberMutation: () => [mockCreate, { isLoading: false }],
  useUpdateNumberMutation: () => [mockUpdate, { isLoading: false }],
}));

vi.mock('@/shared/api/endpoints/userApi', () => ({
  useGetUsersQuery: () => ({
    data: [
      { uniqueid: 10, name: 'Admin User', login: 'admin', exten: '100', level: 1 },
      { uniqueid: 2, name: 'Op User', login: 'op', exten: '201', level: 2 },
      { uniqueid: 3, name: 'Sup User', login: 'sup', exten: '301', level: 3 },
    ],
  }),
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({
    data: [{ name: 'sales', exten: '700', display_name: 'Sales' }],
  }),
}));

vi.mock('@/shared/api/endpoints/routeApi', () => ({
  useGetAllRoutesQuery: () => ({ data: [] }),
}));

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
    MultiSelect: ({
      value,
      onChange,
      options,
      placeholder,
    }: {
      value: string[];
      onChange: (next: string[]) => void;
      options: Array<{ value: string; label: string }>;
      placeholder?: string;
    }) => (
      <div data-testid={`multiselect-${placeholder ?? 'select'}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onChange(
                value.includes(option.value)
                  ? value.filter((item) => item !== option.value)
                  : [...value, option.value],
              );
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    ),
  };
});

import { NumberFormModal } from './NumberFormModal';

async function submitNamedList(name = 'Support') {
  fireEvent.change(screen.getByLabelText(/numbers.name/), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
  await vi.waitFor(() => expect(mockCreate).toHaveBeenCalled());
}

describe('NumberFormModal', () => {
  beforeEach(() => {
    mockState = {
      numbersPage: {
        isModalOpen: true,
        selectedNumber: null,
        modalMode: 'create',
      },
    };
    mockDispatch.mockReset();
    mockCreate.mockClear();
    mockUpdate.mockClear();
  });

  it('offers a fifth AI-threads tab', () => {
    render(<NumberFormModal />);
    expect(screen.getByRole('tab', { name: 'numbers.tabAiThreads' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'numbers.tabCdr' })).toBeInTheDocument();
  });

  it('writes selected thread users as aiThreads.userIds, including tenant admins', async () => {
    const user = userEvent.setup();
    render(<NumberFormModal />);
    await user.click(screen.getByRole('tab', { name: 'numbers.tabAiThreads' }));
    await user.click(screen.getByRole('button', { name: /Admin User/ }));
    await submitNamedList();

    const payload = mockCreate.mock.calls[0][0] as {
      numbers: { aiThreads: { userIds: number[] } };
    };
    expect(payload.numbers.aiThreads.userIds).toEqual([10]);
  });

  it('keeps the existing cdr block when saving thread users', async () => {
    const user = userEvent.setup();
    render(<NumberFormModal />);
    await user.click(screen.getByRole('tab', { name: 'numbers.tabCdr' }));
    await user.click(screen.getByRole('button', { name: /Op User/ }));
    await user.click(screen.getByRole('tab', { name: 'numbers.tabAiThreads' }));
    await user.click(screen.getByRole('button', { name: /Admin User/ }));
    await submitNamedList();

    const payload = mockCreate.mock.calls[0][0] as {
      numbers: {
        aiThreads: { userIds: number[] };
        cdr: { operatorUserIds: number[]; queues: string[] };
      };
    };
    expect(payload.numbers.cdr.operatorUserIds).toEqual([2]);
    expect(payload.numbers.aiThreads.userIds).toEqual([10]);
  });

  it('submits an empty aiThreads.userIds array when the tab is unused', async () => {
    render(<NumberFormModal />);
    await submitNamedList();

    const payload = mockCreate.mock.calls[0][0] as {
      numbers: { aiThreads: { userIds: number[] } };
    };
    expect(payload.numbers.aiThreads.userIds).toEqual([]);
  });

  it('reads raw.aiThreads.userIds when editing an existing list', async () => {
    mockState = {
      numbersPage: {
        isModalOpen: true,
        modalMode: 'edit',
        selectedNumber: {
          id: 4,
          name: 'Existing',
          numbers: {
            aiThreads: { userIds: [10] },
            cdr: { operatorUserIds: [2], queues: [] },
          },
        },
      },
    };

    render(<NumberFormModal />);
    await userEvent.setup().click(screen.getByRole('tab', { name: /numbers.tabAiThreads/ }));
    expect(screen.getByRole('button', { name: /Admin User/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await vi.waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    const payload = mockUpdate.mock.calls[0][0] as {
      id: number;
      data: { numbers: { aiThreads: { userIds: number[] }; cdr: { operatorUserIds: number[] } } };
    };
    expect(payload.id).toBe(4);
    expect(payload.data.numbers.aiThreads.userIds).toEqual([10]);
    expect(payload.data.numbers.cdr.operatorUserIds).toEqual([2]);
  });
});
