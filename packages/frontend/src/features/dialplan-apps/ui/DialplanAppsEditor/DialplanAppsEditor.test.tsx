import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ActionType, IRouteAction } from '@krasterisk/shared';
import { DialplanAppsEditor, restrictToVerticalAxisLocal, buildDndAnnouncements } from './DialplanAppsEditor';
import { ru } from '@/shared/config/locales/ru';
import { en } from '@/shared/config/locales/en';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
    i18n: { language: 'ru' },
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
  useGetQueuesQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/timeGroupApi', () => ({
  useGetTimeGroupsQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: () => ({ data: [], isLoading: false }),
}));

// useSchemaRefs owns every catalog, so each one needs a stub here (no Redux store in this suite).
vi.mock('@/shared/api/endpoints/callGroupApi', () => ({
  useGetCallGroupsQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/ivrsApi', () => ({
  useGetIvrsQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/ttsEnginesApi', () => ({
  useGetTtsEnginesQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/voiceRobotsApi', () => ({
  useGetVoiceRobotsQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/contextApi', () => ({
  useGetContextsQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/numberApi', () => ({
  useGetNumbersQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/notificationApi', () => ({
  useGetNotificationsQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');
  return {
    ...actual,
    DragOverlay: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="chain-drag-overlay">{children}</div>
    ),
  };
});

const specDir = dirname(fileURLToPath(import.meta.url));

function step(id: string, type: ActionType = 'hangup', extras: Partial<IRouteAction> = {}): IRouteAction {
  const { params, condition, ...rest } = extras;
  return {
    id,
    type,
    params: params ?? {},
    condition: condition ?? {},
    ...rest,
  };
}

function Harness(props: React.ComponentProps<typeof DialplanAppsEditor>) {
  const [actions, setActions] = useState(props.actions);
  return <DialplanAppsEditor {...props} actions={actions} onChange={setActions} />;
}

describe('DialplanAppsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables add at maxSteps and shows n / max', () => {
    render(
      <Harness
        actions={[step('a', 'hangup'), step('b', 'hangup', { params: { signal: 'busy' } }), step('c', 'hangup', { params: { signal: 'congestion' } })]}
        onChange={vi.fn()}
        maxSteps={3}
      />,
    );
    const add = screen.getByRole('button', { name: /добавить действие/i });
    expect(add).toBeDisabled();
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
  });

  it('does not render the add button in readOnly', () => {
    render(
      <Harness
        actions={[step('a', 'hangup')]}
        onChange={vi.fn()}
        readOnly
      />,
    );
    expect(screen.queryByRole('button', { name: /добавить действие/i })).toBeNull();
    expect(screen.getByText(/просмотр без изменений/i)).toBeInTheDocument();
  });

  it('renders empty state with ListPlus and no emoji', () => {
    const { container } = render(<Harness actions={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/цепочка действий пуста/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /добавить действие/i })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(screen.getByTestId('chain-empty-icon')).toBeInTheDocument();
  });

  it('filters ActionTypeSelect by allowedTypes', () => {
    render(
      <Harness
        actions={[step('a', '' as ActionType)]}
        onChange={vi.fn()}
        allowedTypes={['hangup']}
      />,
    );
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(values).toEqual(expect.arrayContaining(['hangup']));
    expect(values).not.toContain('toqueue');
    expect(values).not.toContain('busy');
  });

  it('warns about unreachable steps after hangup without blocking add', () => {
    render(
      <Harness
        actions={[step('a', 'hangup'), step('b', 'toqueue')]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/шаг ниже не выполнится/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /добавить действие/i })).not.toBeDisabled();
  });

  it('mounts DragOverlay and exposes ru/en dnd announcements', () => {
    render(<Harness actions={[step('a', 'hangup')]} onChange={vi.fn()} />);
    expect(screen.getAllByTestId('chain-drag-overlay').length).toBeGreaterThan(0);

    const ruT = (key: string, fallback?: string) => fallback ?? key;
    const enT = (key: string, fallback?: string) => fallback ?? key;
    const ruAnn = buildDndAnnouncements(ruT, 'ru');
    const enAnn = buildDndAnnouncements(enT, 'en');
    expect(ruAnn.onDragStart?.({ active: { id: 'a' } } as never)).toMatch(/поднят/i);
    expect(enAnn.onDragStart?.({ active: { id: 'a' } } as never)).toMatch(/picked|lifted/i);
    expect(ruAnn.onDragOver?.({ active: { id: 'a' }, over: { id: 'b' } } as never)).toMatch(/позиц/i);
    expect(enAnn.onDragOver?.({ active: { id: 'a' }, over: { id: 'b' } } as never)).toMatch(/position/i);
    expect(ruAnn.onDragEnd?.({ active: { id: 'a' }, over: { id: 'b' } } as never)).toMatch(/отпущен/i);
    expect(enAnn.onDragEnd?.({ active: { id: 'a' }, over: { id: 'b' } } as never)).toMatch(/dropped/i);
    expect(ruAnn.onDragCancel?.({ active: { id: 'a' } } as never)).toMatch(/отмен/i);
    expect(enAnn.onDragCancel?.({ active: { id: 'a' } } as never)).toMatch(/cancel/i);

    expect(ru.routes.chain.dnd.picked).toBeTruthy();
    expect(en.routes.chain.dnd.picked).toBeTruthy();
    expect(ru.routes.chain.dnd.moved).toBeTruthy();
    expect(en.routes.chain.dnd.moved).toBeTruthy();
    expect(ru.routes.chain.dnd.dropped).toBeTruthy();
    expect(en.routes.chain.dnd.dropped).toBeTruthy();
    expect(ru.routes.chain.dnd.cancelled).toBeTruthy();
    expect(en.routes.chain.dnd.cancelled).toBeTruthy();
  });

  it('locks drag transform to the vertical axis locally', () => {
    const next = restrictToVerticalAxisLocal({
      transform: { x: 12, y: 8, scaleX: 1, scaleY: 1 },
    } as never);
    expect(next).toEqual({ x: 0, y: 8, scaleX: 1, scaleY: 1 });
  });

  it('does not generate step ids with Date.now', () => {
    const src = readFileSync(join(specDir, 'DialplanAppsEditor.tsx'), 'utf8');
    expect(src).not.toMatch(/Date\.now\s*\(/);
    expect(src).toMatch(/crypto\.randomUUID/);
  });

  it('locks the drag axis without an extra dnd-kit package', () => {
    const editorSrc = readFileSync(join(specDir, 'DialplanAppsEditor.tsx'), 'utf8');
    expect(editorSrc).not.toMatch(['@dnd-kit', 'modifiers'].join('/'));
    expect(editorSrc).toMatch(/restrictToVerticalAxisLocal/);
  });

  it('round-trips an unknown action type without rewriting params', () => {
    const unknown = step('u1', 'legacy_widget' as ActionType, {
      params: { foo: 'keep', nested: { a: 1 } },
    });
    function RoundTrip() {
      const [actions, setActions] = useState([unknown]);
      return (
        <>
          <DialplanAppsEditor actions={actions} onChange={setActions} />
          <pre data-testid="payload">{JSON.stringify(actions)}</pre>
        </>
      );
    }
    render(<RoundTrip />);
    expect(screen.getByText('legacy_widget')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/настроить/i));
    expect(JSON.parse(screen.getByTestId('payload').textContent ?? '[]')).toEqual([unknown]);
  });
});
