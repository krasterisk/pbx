import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { CallerIdEditor } from './CallerIdEditor';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));
vi.mock('../../model/useSchemaRefs', () => ({ useSchemaRefs: () => ({}) }));
function Fixture({ changed = vi.fn() }) {
  const [params, setParams] = useState<Record<string, unknown>>({ version: 2 });
  return (
    <CallerIdEditor
      params={params}
      onChange={(next) => {
        setParams(next);
        changed(next);
      }}
    />
  );
}
describe('Caller ID editor', () => {
  it('never offers an access-list source, but keeps manually entered numbers', () => {
    render(<Fixture />);
    const source = screen.getByRole('combobox', {
      name: 'routes.apps.calleridV2.numberSource',
    }) as HTMLSelectElement;
    expect(Array.from(source.options).map((option) => option.value)).toEqual([
      'current',
      'fixed',
      'directory',
      'variable',
      'pool',
    ]);
  });
  it('explains a saved access-list source and keeps it until an explicit replacement', () => {
    const changed = vi.fn();
    render(
      <CallerIdEditor
        params={{
          version: 2,
          number: {
            source: {
              source: 'number_list',
              listUid: 7,
              pick: 'first',
              keySource: { source: 'original_caller' },
            },
          },
        }}
        onChange={changed}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'routes.apps.calleridV2.accessListUnavailable',
    );
    expect(
      screen.getByRole('combobox', {
        name: 'routes.apps.calleridV2.numberSource',
      }),
    ).toHaveValue('');
    expect(changed).not.toHaveBeenCalled();
    fireEvent.change(
      screen.getByRole('combobox', {
        name: 'routes.apps.calleridV2.numberSource',
      }),
      { target: { value: 'current' } },
    );
    expect(changed).toHaveBeenCalledWith(
      expect.objectContaining({
        number: expect.objectContaining({ source: { source: 'current' } }),
      }),
    );
  });
  it('accepts a Cyrillic name prefix and suffix and previews text instead of phone validation', () => {
    const changed = vi.fn();
    render(<Fixture changed={changed} />);
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: 'routes.apps.calleridV2.nameTab' }),
      { button: 0, ctrlKey: false },
    );
    fireEvent.change(
      screen.getByRole('combobox', {
        name: /routes.apps.calleridV2.(numberSource|nameSource)/,
      }),
      { target: { value: 'fixed' } },
    );
    fireEvent.change(
      screen.getByLabelText('routes.apps.calleridV2.nameValue'),
      { target: { value: 'Иван' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /Раскрыть/i }));
    fireEvent.change(screen.getByLabelText('Добавить в начало'), {
      target: { value: 'Отдел: ' },
    });
    fireEvent.change(screen.getByLabelText('Добавить в конец'), {
      target: { value: ' / Sales' },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Отдел: Иван / Sales')).toBeInTheDocument();
    expect(screen.queryByText('invalid_transform')).not.toBeInTheDocument();
  });

  it('disables expert mode in both Caller ID tabs', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: /Раскрыть/i }));
    expect(screen.getByLabelText('Добавить в начало')).toBeInTheDocument();
    expect(screen.queryByLabelText('Экспертный режим')).not.toBeInTheDocument();
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: 'routes.apps.calleridV2.nameTab' }),
      {
        button: 0,
        ctrlKey: false,
      },
    );
    fireEvent.click(screen.getByRole('button', { name: /Раскрыть/i }));
    expect(screen.getByLabelText('Добавить в начало')).toBeInTheDocument();
    expect(screen.queryByLabelText('Экспертный режим')).not.toBeInTheDocument();
  });

  it('clears explicitly even when the previous source is an incomplete pool', () => {
    const changed = vi.fn();
    render(<Fixture changed={changed} />);
    fireEvent.change(
      screen.getByRole('combobox', {
        name: /routes.apps.calleridV2.(numberSource|nameSource)/,
      }),
      {
        target: { value: 'pool' },
      },
    );
    fireEvent.click(
      screen.getByRole('switch', { name: 'routes.apps.calleridV2.clear' }),
    );
    expect(changed).toHaveBeenLastCalledWith({
      version: 2,
      number: { source: { source: 'current' }, clear: true },
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('keeps number and name independent when navigating tabs', () => {
    const changed = vi.fn();
    render(<Fixture changed={changed} />);
    fireEvent.change(
      screen.getByRole('combobox', {
        name: /routes.apps.calleridV2.(numberSource|nameSource)/,
      }),
      {
        target: { value: 'fixed' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('routes.apps.calleridV2.numberValue'),
      {
        target: { value: '201' },
      },
    );
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: 'routes.apps.calleridV2.nameTab' }),
      {
        button: 0,
        ctrlKey: false,
      },
    );
    fireEvent.change(
      screen.getByRole('combobox', {
        name: /routes.apps.calleridV2.(numberSource|nameSource)/,
      }),
      {
        target: { value: 'fixed' },
      },
    );
    fireEvent.change(
      screen.getByLabelText('routes.apps.calleridV2.nameValue'),
      {
        target: { value: 'Отдел' },
      },
    );
    expect(changed).toHaveBeenLastCalledWith({
      version: 2,
      number: { source: { source: 'fixed', value: '201' } },
      name: { source: { source: 'fixed', value: 'Отдел' } },
    });
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: 'routes.apps.calleridV2.numberTab' }),
      {
        button: 0,
        ctrlKey: false,
      },
    );
    expect(
      screen.getByLabelText('routes.apps.calleridV2.numberValue'),
    ).toHaveValue('201');
    expect(
      screen.queryByRole('tab', { name: 'CID-карусель' }),
    ).not.toBeInTheDocument();
  });
  it('offers pools only for number, validates them and exposes clear explicitly', () => {
    render(<Fixture />);
    fireEvent.change(
      screen.getByRole('combobox', {
        name: /routes.apps.calleridV2.(numberSource|nameSource)/,
      }),
      {
        target: { value: 'pool' },
      },
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'routes.apps.calleridV2.invalid',
    );
    fireEvent.mouseDown(
      screen.getByRole('tab', { name: 'routes.apps.calleridV2.nameTab' }),
      {
        button: 0,
        ctrlKey: false,
      },
    );
    expect(
      screen.queryByRole('option', { name: 'routes.apps.calleridV2.pool' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'routes.apps.calleridV2.clear' }),
    ).not.toBeChecked();
  });
});
