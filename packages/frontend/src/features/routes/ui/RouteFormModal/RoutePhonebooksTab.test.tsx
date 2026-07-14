import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoutePhonebooksTab } from './RoutePhonebooksTab';
import * as phonebookApiHooks from '@/shared/api/endpoints/phonebookApi';
import type { IRoutePhonebookBinding } from '@krasterisk/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useGetPhonebooksQuery: vi.fn(),
  };
});

vi.mock('@/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor', () => ({
  DialplanAppsEditor: ({ actions }: { actions: any[] }) => (
    <div data-testid="dialplan-apps-editor">actions:{actions.length}</div>
  ),
}));

const mockPhonebooks = [
  { uid: 1, name: 'Blacklist', description: '', user_uid: 1 },
  { uid: 2, name: 'VIP', description: '', user_uid: 1 },
];

const twoBindings: IRoutePhonebookBinding[] = [
  {
    phonebook_uid: 1,
    position: 0,
    match_mode: 'on_match',
    behavior_type: 'vars_only',
    behavior_params: null,
    actions: null,
    phonebook: mockPhonebooks[0] as any,
  },
  {
    phonebook_uid: 2,
    position: 1,
    match_mode: 'on_match',
    behavior_type: 'set_name',
    behavior_params: null,
    actions: null,
    phonebook: mockPhonebooks[1] as any,
  },
];

/** Stateful harness so up/down/remove/add mutations are visible in the DOM. */
function Harness({ initial }: { initial: IRoutePhonebookBinding[] }) {
  const [bindings, setBindings] = useState(initial);
  return <RoutePhonebooksTab bindings={bindings} setBindings={setBindings} />;
}

describe('RoutePhonebooksTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (phonebookApiHooks.useGetPhonebooksQuery as any).mockReturnValue({ data: mockPhonebooks });
  });

  it('renders a list of bindings, reorders, and removes rows', () => {
    render(<Harness initial={twoBindings} />);

    // Phonebook names also appear as <option> text in the add-row select
    // below the list, so exclude those when reading back binding row order.
    const bindingNames = () => screen.getAllByText(/Blacklist|VIP/)
      .filter((el) => el.tagName !== 'OPTION')
      .map((el) => el.textContent);

    expect(bindingNames()).toEqual(['Blacklist', 'VIP']);

    // Move the second row (VIP) up — it should now render before Blacklist.
    const moveUpButtons = screen.getAllByTitle('Вверх');
    fireEvent.click(moveUpButtons[1]);

    expect(bindingNames()).toEqual(['VIP', 'Blacklist']);

    // Remove the first (now VIP) row.
    const deleteButtons = screen.getAllByTitle('Удалить');
    fireEvent.click(deleteButtons[0]);

    expect(bindingNames()).toEqual(['Blacklist']);
  });

  it('adds a new binding row via the phonebook select + plus button', () => {
    render(<Harness initial={[]} />);

    expect(screen.getByText(/Добавьте справочник/)).toBeInTheDocument();
    expect(screen.queryAllByTitle('Удалить')).toHaveLength(0);

    // 'VIP' is already present as an <option> in the phonebook select below the
    // (empty) list, so assert on the row itself rather than on text content.
    const select = screen.getByDisplayValue('Выберите справочник');
    fireEvent.change(select, { target: { value: '2' } });
    fireEvent.click(screen.getByText('Добавить справочник'));

    expect(screen.getAllByTitle('Удалить')).toHaveLength(1);
    expect(screen.getByDisplayValue('vars_only')).toBeInTheDocument();
  });

  it('reveals DialplanAppsEditor when behavior_type is switched to custom', () => {
    render(<Harness initial={[twoBindings[0]]} />);

    expect(screen.queryByTestId('dialplan-apps-editor')).not.toBeInTheDocument();

    const behaviorSelect = screen.getByDisplayValue('vars_only');
    fireEvent.change(behaviorSelect, { target: { value: 'custom' } });

    expect(screen.getByTestId('dialplan-apps-editor')).toBeInTheDocument();
  });

  it('shows var_key/fixed_exten fields when behavior_type is redirect', () => {
    render(<Harness initial={[twoBindings[0]]} />);

    const behaviorSelect = screen.getByDisplayValue('vars_only');
    fireEvent.change(behaviorSelect, { target: { value: 'redirect' } });

    expect(screen.getByPlaceholderText('redirect')).toBeInTheDocument();
  });

  it('narrows the preset list when match_mode is switched to on_no_match', () => {
    render(<Harness initial={[twoBindings[0]]} />);

    const matchModeSelect = screen.getByDisplayValue('При совпадении') as HTMLSelectElement;
    fireEvent.change(matchModeSelect, { target: { value: 'on_no_match' } });

    // The binding row's own div wraps both selects as siblings.
    const row = matchModeSelect.parentElement as HTMLElement;
    const behaviorSelect = within(row).getAllByRole('combobox')[1] as HTMLSelectElement;
    const options = Array.from(behaviorSelect.options).map((o) => o.value);

    expect(options).not.toContain('vars_only');
    expect(options).not.toContain('set_number');
    expect(options).toEqual(['set_name', 'blacklist', 'whitelist', 'redirect', 'custom']);
  });
});
