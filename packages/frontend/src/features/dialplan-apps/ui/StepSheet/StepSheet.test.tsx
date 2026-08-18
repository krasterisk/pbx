import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IRouteAction } from '@krasterisk/shared';
import { DialplanAppsEditor } from '../DialplanAppsEditor/DialplanAppsEditor';
import { StepSheet } from './StepSheet';
import * as queueApiHooks from '@/shared/api/endpoints/queueApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { user: { vpbx_user_uid: 42 } } }),
}));

vi.mock('@/entities/User', () => ({
  selectCurrentUser: (state: { auth?: { user?: { vpbx_user_uid: number } } }) =>
    state.auth?.user,
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: vi.fn(),
}));

vi.mock('@/shared/api/endpoints/timeGroupApi', () => ({
  useGetTimeGroupsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/ui', async () => {
  const actual = await vi.importActual<typeof import('@/shared/ui')>('@/shared/ui');
  return {
    ...actual,
    Sheet: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    SheetContent: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SheetHeader: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SheetFooter: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SheetTitle: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SheetDescription: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    SheetClose: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    InfoTooltip: ({ text }: { text: string }) => <span>{text}</span>,
  };
});

const emptyAction: IRouteAction = {
  id: 'step-1',
  type: '' as IRouteAction['type'],
  params: {},
  condition: {},
};

function EditorHarness({ initial = [emptyAction] }: { initial?: IRouteAction[] }) {
  const [actions, setActions] = useState(initial);
  return <DialplanAppsEditor actions={actions} onChange={setActions} />;
}

describe('StepSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (queueApiHooks.useGetQueuesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ name: 'qsales_42', exten: 'sales', display_name: 'Sales' }],
      isLoading: false,
    });
  });

  it('opens Sheet when toqueue is chosen on an empty row', () => {
    render(<EditorHarness />);
    const typeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'toqueue' } });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('switching to route_pattern patches target and shows tenant-scoped chip', () => {
    const onChange = vi.fn();
    function ChipHarness() {
      const [action, setAction] = useState<IRouteAction>({
        id: 'step-1',
        type: 'toqueue',
        params: { target: { source: 'fixed', value: 'sales' }, options: 'thH' },
        condition: {},
      });
      return (
        <StepSheet
          open
          stepId="step-1"
          tenantUid={42}
          action={action}
          onOpenChange={vi.fn()}
          onChange={(patch) => {
            onChange(patch);
            setAction((prev) => ({ ...prev, params: { ...prev.params, ...patch } }));
          }}
          onTypeChange={vi.fn()}
        />
      );
    }
    render(<ChipHarness />);

    fireEvent.click(screen.getByRole('tab', { name: 'По маске маршрута' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ source: 'route_pattern' }),
      }),
    );
    expect(screen.getByText(/^q.*_\d+$/)).toBeInTheDocument();
  });

  it('distinguishes queues loading from empty catalog (backstop)', () => {
    (queueApiHooks.useGetQueuesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    const { rerender } = render(
      <StepSheet
        open
        stepId="step-1"
        tenantUid={42}
        action={{
          id: 'step-1',
          type: 'toqueue',
          params: { target: { source: 'fixed', value: '' }, options: 'thH' },
          condition: {},
        }}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onTypeChange={vi.fn()}
      />,
    );

    const loadingSelect = screen.getByRole('combobox', { name: 'Загружаем список' });
    expect(loadingSelect).toBeDisabled();
    const loadingText = loadingSelect.textContent;

    (queueApiHooks.useGetQueuesQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });
    rerender(
      <StepSheet
        open
        stepId="step-1"
        tenantUid={42}
        action={{
          id: 'step-1',
          type: 'toqueue',
          params: { target: { source: 'fixed', value: '' }, options: 'thH' },
          condition: {},
        }}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onTypeChange={vi.fn()}
      />,
    );

    const emptySelect = screen.getByRole('combobox', { name: 'Ничего не создано' });
    expect(emptySelect).toBeDisabled();
    expect(emptySelect.textContent).not.toBe(loadingText);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
