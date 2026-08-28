import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RouteDirectoriesTab } from './RouteDirectoriesTab';
import type { IDirectory, IRouteDirectoryBinding } from '@krasterisk/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/features/dialplan-apps/model/useSchemaRefs', () => ({
  useSchemaRefs: () => ({
    dialplanDirectories: {
      items: [
        { value: '1', label: 'Blacklist' },
        { value: '2', label: 'VIP' },
      ],
      isLoading: false,
    },
  }),
}));

const DIRECTORY: IDirectory = {
  uid: 1,
  user_uid: 1,
  name: 'Blacklist',
  lookup_field_uid: 17,
  key_normalization: 'digits',
  revision: 1,
  fields: [
    { uid: 17, directory_uid: 1, key: 'phone', label: 'Phone', type: 'phone', required: true, position: 0 },
    { uid: 18, directory_uid: 1, key: 'name', label: 'Name', type: 'string', required: false, position: 1 },
  ],
};

vi.mock('@/shared/api/endpoints/directoryApi', () => ({
  useGetDirectoryQuery: () => ({ data: DIRECTORY, isLoading: false }),
}));

vi.mock('@/features/dialplan-apps/ui/DialplanAppsEditor/DialplanAppsEditor', () => ({
  DialplanAppsEditor: ({
    actions,
    host,
    allowedTypes,
  }: {
    actions: unknown[];
    host?: string;
    allowedTypes?: string[];
  }) => (
    <div
      data-testid="dialplan-apps-editor"
      data-host={host}
      data-allowed={(allowedTypes ?? []).join(',')}
    >
      actions:{actions.length}
    </div>
  ),
}));

const twoBindings: IRouteDirectoryBinding[] = [
  {
    directory_uid: 1,
    position: 0,
    key_source: { source: 'original_caller' },
    match_mode: 'on_match',
    behavior_type: 'set_name',
    behavior_params: { fieldUid: 18 },
    actions: null,
    directory: { ...DIRECTORY, name: 'Blacklist' },
  },
  {
    directory_uid: 2,
    position: 1,
    key_source: { source: 'original_caller' },
    match_mode: 'on_match',
    behavior_type: 'drop',
    behavior_params: null,
    actions: null,
    directory: { ...DIRECTORY, uid: 2, name: 'VIP' },
  },
];

function Harness({ initial }: { initial: IRouteDirectoryBinding[] }) {
  const [bindings, setBindings] = useState(initial);
  return <RouteDirectoriesTab bindings={bindings} setBindings={setBindings} />;
}

describe('RouteDirectoriesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bindings, reorders, and removes rows', () => {
    render(<Harness initial={twoBindings} />);

    const bindingNames = () => screen.getAllByText(/Blacklist|VIP/)
      .filter((el) => el.tagName !== 'OPTION')
      .map((el) => el.textContent);

    expect(bindingNames()).toEqual(['Blacklist', 'VIP']);

    fireEvent.click(screen.getAllByTitle('Вверх')[1]);
    expect(bindingNames()).toEqual(['VIP', 'Blacklist']);

    fireEvent.click(screen.getAllByTitle('Удалить')[0]);
    expect(bindingNames()).toEqual(['Blacklist']);
  });

  it('adds a directory policy with key_source and field UIDs, without phonebook properties', () => {
    const setBindings = vi.fn();
    render(<RouteDirectoriesTab bindings={[]} setBindings={setBindings} />);

    expect(screen.getByText(/Добавьте справочник/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Выберите справочник'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Добавить справочник'));

    expect(setBindings).toHaveBeenCalledTimes(1);
    const next = setBindings.mock.calls[0][0] as IRouteDirectoryBinding[];
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      directory_uid: 2,
      position: 0,
      key_source: { source: 'original_caller' },
      match_mode: 'on_match',
    });
    expect(next[0]).not.toHaveProperty('phonebook_uid');
    expect(next[0]).not.toHaveProperty('phonebook');
  });

  it('offers directory policy presets including map_fields and custom', () => {
    render(<Harness initial={[twoBindings[0]]} />);

    const behaviorSelect = screen.getByDisplayValue('Подставить имя') as HTMLSelectElement
      ?? screen.getAllByRole('combobox').find((el) =>
        Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'set_name'),
      );
    const options = Array.from(
      (screen.getAllByRole('combobox').find((el) =>
        Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'map_fields'),
      ) as HTMLSelectElement).options,
    ).map((o) => o.value);

    expect(options).toEqual(['set_name', 'set_number', 'redirect', 'map_fields', 'drop', 'custom']);
    expect(options).not.toContain('vars_only');
    expect(behaviorSelect).toBeTruthy();
  });

  it('reveals DialplanAppsEditor with host=directory_policy for custom', () => {
    render(<Harness initial={[twoBindings[0]]} />);

    const behaviorSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'custom'),
    ) as HTMLSelectElement;
    fireEvent.change(behaviorSelect, { target: { value: 'custom' } });

    const editor = screen.getByTestId('dialplan-apps-editor');
    expect(editor).toHaveAttribute('data-host', 'directory_policy');
    const allowed = editor.getAttribute('data-allowed') ?? '';
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.split(',')).not.toContain('cmd');
  });
});
