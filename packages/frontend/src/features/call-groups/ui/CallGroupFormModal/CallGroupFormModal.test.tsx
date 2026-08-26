import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CallGroupFormModal } from './CallGroupFormModal';
import * as callGroupApiHooks from '@/shared/api/endpoints/callGroupApi';
import * as contextApiHooks from '@/shared/api/endpoints/contextApi';
import * as endpointApiHooks from '@/shared/api/endpoints/endpointApi';
import * as promptsApiHooks from '@/shared/api/endpoints/promptsApi';
import * as mohApiHooks from '@/shared/api/endpoints/mohApi';
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
    i18n: { language: 'ru' },
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

vi.mock('@/shared/api/endpoints/endpointApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetEndpointsQuery: vi.fn(),
  };
});

vi.mock('@/shared/api/endpoints/promptsApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetPromptsQuery: vi.fn(),
  };
});

vi.mock('@/shared/api/endpoints/mohApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useGetMohClassesQuery: vi.fn(),
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

const mockEndpoints = [
  { id: 'e202_42', extension: '202', callerid: '"Alice" <202>' },
  { id: 'e303_42', extension: '303', callerid: '"Bob" <303>' },
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
    (endpointApiHooks.useGetEndpointsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockEndpoints,
      isLoading: false,
    });
    (promptsApiHooks.useGetPromptsQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ uid: 1, filename: 'welcome', comment: 'Welcome' }],
      isLoading: false,
    });
    (mohApiHooks.useGetMohClassesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ name: 'moh_15_sales', displayName: 'Sales' }],
      isLoading: false,
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
    fireEvent.change(screen.getByLabelText('Номер'), { target: { value: '6007' } });
    fireEvent.change(screen.getByLabelText('Стратегия'), { target: { value: 'hunt' } });

    const addRow = screen.getByText('Добавить участника').closest('div') as HTMLElement;
    const addTypeSelect = within(addRow).getAllByRole('combobox')[0] as HTMLSelectElement;

    // External member with ring time
    fireEvent.change(addTypeSelect, { target: { value: 'external' } });
    fireEvent.change(screen.getByPlaceholderText('Внешний номер'), { target: { value: '79001112233' } });
    fireEvent.change(screen.getByPlaceholderText('Сек.'), { target: { value: '15' } });
    fireEvent.click(screen.getByText('Добавить участника'));

    // Context for external appears in the members block
    expect(screen.getByLabelText('Контекст для внешних')).toBeInTheDocument();

    // Internal member from endpoint select
    fireEvent.change(addTypeSelect, { target: { value: 'internal' } });
    const selects = within(addRow).getAllByRole('combobox');
    const endpointSelect = selects[selects.length - 1] as HTMLSelectElement;
    fireEvent.change(endpointSelect, { target: { value: '202' } });
    fireEvent.click(screen.getByText('Добавить участника'));

    fireEvent.click(screen.getByText('Сохранить'));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const rawCall = mockCreate.mock.calls[0] as unknown as
      | [{ name: string; members: Array<{
          member_type: string;
          value: string;
          position: number;
          ring_time?: number;
        }> }]
      | undefined;
    const payload = rawCall?.[0];
    expect(payload).toBeDefined();
    expect(payload!.name).toBe('Sales ring');
    expect((payload as { exten?: string }).exten).toBe('6007');
    expect(payload!.members).toHaveLength(2);
    expect(payload!.members[0]).toMatchObject({
      member_type: 'external',
      value: '79001112233',
      position: 0,
      ring_time: 15,
    });
    expect(payload!.members[1]).toMatchObject({
      member_type: 'internal',
      value: '202',
      position: 1,
    });
  });

  it('marks invalid group Dial options and does not call the save mutation', () => {
    render(<CallGroupFormModal />);

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Sales ring' } });
    fireEvent.change(screen.getByLabelText('Номер'), { target: { value: '6007' } });

    const addRow = screen.getByText('Добавить участника').closest('div') as HTMLElement;
    const addTypeSelect = within(addRow).getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(addTypeSelect, { target: { value: 'internal' } });
    const selects = within(addRow).getAllByRole('combobox');
    fireEvent.change(selects[selects.length - 1] as HTMLSelectElement, { target: { value: '202' } });
    fireEvent.click(screen.getByText('Добавить участника'));

    fireEvent.click(screen.getByRole('button', { name: /Настройки обзвона/i }));
    fireEvent.click(screen.getByRole('button', { name: /Опции Dial/i }));
    fireEvent.click(screen.getByRole('button', { name: /Показать строку опций/i }));
    fireEvent.change(screen.getByLabelText('Строка опций'), { target: { value: 'tTU(x' } });

    fireEvent.click(screen.getByText('Сохранить'));
    expect(screen.getAllByText('Незакрытая скобка в строке опций').length).toBeGreaterThan(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
