import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ActionType, IRouteAction } from '@krasterisk/shared';
import { PlaybackApp, summarizePlayback } from './PlaybackApp';
import { ActionTypeSelect } from '../../ActionTypeSelect';
import { dialplanAppsRegistry } from '../../../model/registry';
import { DialplanAppsEditor } from '../../DialplanAppsEditor/DialplanAppsEditor';

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

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: () => ({
    data: [{ uid: 1, filename: 'welcome', comment: 'Welcome' }],
    isLoading: false,
  }),
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

const MODE_PLAIN = 'Без прерывания';
const MODE_CONTROL = 'С перемоткой / паузой';
const MODE_MENU = 'С выходом по цифре в меню';

function Harness({
  initial = { mode: 'plain', files: 'welcome' },
}: {
  initial?: Record<string, unknown>;
}) {
  const [params, setParams] = useState(initial);
  return (
    <PlaybackApp
      params={params}
      onChange={(patch) => setParams((prev) => ({ ...prev, ...patch }))}
    />
  );
}

function step(id: string, type: ActionType, extras: Partial<IRouteAction> = {}): IRouteAction {
  return {
    id,
    type,
    params: extras.params ?? {},
    condition: extras.condition ?? {},
    ...extras,
  };
}

describe('PlaybackApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders exactly three mode cards from the copywriting contract without Asterisk app names', () => {
    render(<Harness />);
    const cards = screen.getAllByRole('radio');
    expect(cards).toHaveLength(3);
    const labels = cards.map((card) => card.textContent ?? '');
    expect(labels.some((text) => text.includes(MODE_PLAIN))).toBe(true);
    expect(labels.some((text) => text.includes(MODE_CONTROL))).toBe(true);
    expect(labels.some((text) => text.includes(MODE_MENU))).toBe(true);
    expect(labels.join(' ')).not.toMatch(/Playback|BackGround|ControlPlayback/i);
  });

  it('hides langoverride in plain mode and shows it in menu mode', () => {
    render(<Harness initial={{ mode: 'plain', files: 'welcome' }} />);
    expect(screen.queryByLabelText(/язык|language|langoverride/i)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: new RegExp(MODE_MENU) }));
    expect(screen.getByLabelText(/язык|language|langoverride/i)).toBeInTheDocument();
  });

  it('omits playprompt and background from create select but keeps playprompt in the registry', () => {
    render(<ActionTypeSelect value="" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).not.toContain('playprompt');
    expect(values).not.toContain('background');
    expect(dialplanAppsRegistry.playprompt).toBeDefined();
    expect(dialplanAppsRegistry.playprompt.component).toBeTruthy();
  });

  it('shows a may-exit badge for menu mode and warns about the tail without blocking save', () => {
    render(
      <DialplanAppsEditor
        actions={[
          step('a', 'playback', { params: { mode: 'menu', files: 'menu' } }),
          step('b', 'setclid_custom', { params: { callerid: '7900' } }),
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Может выйти из цепочки')).toBeInTheDocument();
    expect(screen.getByText(/шаг ниже может не выполниться/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /добавить действие/i })).not.toBeDisabled();
  });

  it('summarize names the mode and file without Asterisk app names', () => {
    const t = (key: string, fallback?: string) => fallback ?? key;
    const summary = summarizePlayback({ mode: 'plain', files: 'welcome' }, t);
    expect(summary).toContain(MODE_PLAIN);
    expect(summary).toContain('welcome');
    expect(summary).not.toMatch(/Playback|BackGround|ControlPlayback/i);
  });
});
