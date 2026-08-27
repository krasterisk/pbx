import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IRouteAction } from '@krasterisk/shared';
import { DialplanAppsEditor } from '../DialplanAppsEditor/DialplanAppsEditor';
import { StepSheet } from './StepSheet';
import * as queueApiHooks from '@/shared/api/endpoints/queueApi';
import * as phonebookApiHooks from '@/shared/api/endpoints/phonebookApi';

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

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: vi.fn(),
}));

vi.mock('@/shared/api/endpoints/timeGroupApi', () => ({
  useGetTimeGroupsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/callGroupApi', () => ({
  useGetCallGroupsQuery: vi.fn(() => ({
    data: [{ uid: 7, name: 'Sales group' }],
    isLoading: false,
  })),
}));

vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: vi.fn(() => ({
    data: [{ id: 1, name: 'trunk-main' }],
    isLoading: false,
  })),
}));

// useSchemaRefs owns every catalog, so each one needs a stub here (no Redux store in this suite).
vi.mock('@/shared/api/endpoints/ivrsApi', () => ({
  useGetIvrsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/ttsEnginesApi', () => ({
  useGetTtsEnginesQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/voiceRobotsApi', () => ({
  useGetVoiceRobotsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/contextApi', () => ({
  useGetContextsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/numberApi', () => ({
  useGetNumbersQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationsQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/shared/ui', async () => {
  const actual = await vi.importActual<typeof import('@/shared/ui')>('@/shared/ui');
  return {
    ...actual,
    Sheet: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    SheetContent: ({
      children,
      side,
      className,
      style,
    }: {
      children?: React.ReactNode;
      side?: string;
      className?: string;
      style?: React.CSSProperties;
    }) => (
      <div data-testid="sheet-content" data-side={side} className={className} style={style}>
        {children}
      </div>
    ),
    SheetHeader: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="step-sheet-header">{children}</div>
    ),
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
    (phonebookApiHooks.useGetPhonebooksQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it('opens Sheet when toqueue is chosen on an empty row', () => {
    render(<EditorHarness />);
    const typeSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(typeSelect, { target: { value: 'toqueue' } });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('switching to route_pattern patches target without showing tenant internals', () => {
    const onChange = vi.fn();
    function SourceHarness() {
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
    render(<SourceHarness />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Очередь' }), {
      target: { value: '__src:route_pattern' },
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ source: 'route_pattern' }),
      }),
    );
    expect(screen.queryByText(/^q\$\{EXTEN\}_/)).not.toBeInTheDocument();
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

    const emptySelects = screen.getAllByRole('combobox', { name: 'Ничего не создано' });
    const emptySelect = emptySelects[0];
    expect(emptySelect).toBeDisabled();
    expect(emptySelect.textContent).not.toBe(loadingText);
    const link = screen.getByRole('link', { name: /Очереди/ });
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('highlights required queue and keeps sheet open when close is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onOpenChange = vi.fn();
    render(
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
        onOpenChange={onOpenChange}
        onChange={vi.fn()}
        onTypeChange={vi.fn()}
      />,
    );

    const close = screen.getByRole('button', { name: /Закрыть/ });
    expect(close).not.toBeDisabled();
    fireEvent.click(close);
    expect(confirmSpy).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText('Укажите очередь')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('closes without queue when user confirms', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onOpenChange = vi.fn();
    render(
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
        onOpenChange={onOpenChange}
        onChange={vi.fn()}
        onTypeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Закрыть/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    confirmSpy.mockRestore();
  });

  it('has no OK / Apply pair inside the sheet (D-02)', () => {
    render(
      <StepSheet
        open
        stepId="step-1"
        tenantUid={42}
        action={{
          id: 'step-1',
          type: 'hangup',
          params: {},
          condition: {},
        }}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onTypeChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /ОК|Применить|Apply/i })).toBeNull();
  });

  it('uses a bottom sheet with 85dvh max-height and a scrolling body', () => {
    render(
      <StepSheet
        open
        stepId="step-1"
        tenantUid={42}
        forceSide="bottom"
        action={{
          id: 'step-1',
          type: 'hangup',
          params: {},
          condition: {},
        }}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onTypeChange={vi.fn()}
      />,
    );
    const panel = screen.getByTestId('sheet-content');
    expect(panel).toHaveAttribute('data-side', 'bottom');
    expect(panel.className).toMatch(/panelBottom/);
    const body = screen.getByTestId('step-sheet-body');
    expect(body.className).toMatch(/body/);
    expect(screen.getByTestId('step-sheet-header')).not.toHaveStyle({ overflowY: 'auto' });
  });

  it('does not move focus to the action type while editing a field', () => {
    function Harness() {
      const [action, setAction] = useState<IRouteAction>({
        id: 'step-1',
        type: 'toqueue',
        params: { target: { source: 'fixed', value: 'sales' }, timeout: 30, options: 'thH' },
        condition: {},
      });
      return (
        <StepSheet
          open
          stepId="step-1"
          tenantUid={42}
          initialSection="params"
          action={action}
          onOpenChange={vi.fn()}
          onChange={(patch) => {
            setAction((prev) => ({ ...prev, params: { ...prev.params, ...patch } }));
          }}
          onTypeChange={vi.fn()}
        />
      );
    }
    render(<Harness />);

    const timeout = screen.getByRole('spinbutton', { name: 'Таймаут, сек' });
    timeout.focus();
    fireEvent.change(timeout, { target: { value: '45' } });
    expect(timeout).toHaveFocus();

    fireEvent.change(screen.getByRole('combobox', { name: 'Приоритет' }), {
      target: { value: '__src:fixed' },
    });
    const priority = screen.getByRole('spinbutton', { name: 'Приоритет' });
    priority.focus();
    fireEvent.change(priority, { target: { value: '5' } });
    expect(priority).toHaveFocus();
    expect(screen.getByLabelText('Действие шага')).not.toHaveFocus();
  });

  it('focuses the first invalid field on open', () => {
    render(
      <StepSheet
        open
        stepId="step-1"
        tenantUid={42}
        initialSection="params"
        action={{
          id: 'step-1',
          type: 'toexten',
          params: { target: { source: 'fixed', value: '' } },
          condition: {},
        }}
        fieldErrors={{ target: 'required' }}
        onOpenChange={vi.fn()}
        onChange={vi.fn()}
        onTypeChange={vi.fn()}
      />,
    );
    expect(document.activeElement).toHaveAttribute('aria-invalid', 'true');
    expect(document.activeElement).toHaveAttribute('aria-label', 'Абонент');
  });
});
