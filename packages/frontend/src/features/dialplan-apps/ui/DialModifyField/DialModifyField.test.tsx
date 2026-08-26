import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DialModifyField } from './DialModifyField';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({ data: [], isLoading: false }),
}));

function expandModifySection() {
  fireEvent.click(screen.getByRole('button', { name: /Раскрыть/i }));
}

describe('DialModifyField', () => {
  it('starts collapsed when there is no rewrite configuration', () => {
    render(
      <DialModifyField
        source={{ source: 'route_pattern' }}
        previewPatterns={['_7XXXXXXXXXX']}
        onRewriteChange={vi.fn()}
        charset="phone"
      />,
    );

    expect(screen.getByText('Модификация номера')).toBeInTheDocument();
    expect(screen.queryByLabelText('Добавить в начало')).not.toBeInTheDocument();
    expect(screen.queryByText('Что уйдёт в набор')).not.toBeInTheDocument();
  });

  it('auto-expands when rewrite configuration already exists', () => {
    render(
      <DialModifyField
        rewrite={{
          noMatch: 'passthrough',
          rules: [{ id: 'basic', enabled: true, conditions: [], transform: { prefix: '8' } }],
        }}
        onRewriteChange={vi.fn()}
        charset="phone"
      />,
    );

    expect(screen.getByLabelText('Добавить в начало')).toBeInTheDocument();
    expect(screen.getByText('Что уйдёт в набор')).toBeInTheDocument();
  });

  it('shows the basic form and auto-previews after expand', () => {
    render(
      <DialModifyField
        source={{ source: 'route_pattern' }}
        previewPatterns={['_7XXXXXXXXXX']}
        onRewriteChange={vi.fn()}
        charset="phone"
      />,
    );

    expandModifySection();

    expect(screen.getByLabelText('Добавить в начало')).toBeInTheDocument();
    expect(screen.queryByLabelText('Пример номера')).not.toBeInTheDocument();
    expect(screen.getAllByText('70000000000')).toHaveLength(2);
    expect(screen.getByText(/Пример B-номера/)).toBeInTheDocument();
  });

  it('locks preview to a fixed destination value when expanded', () => {
    render(
      <DialModifyField
        source={{ source: 'fixed', value: '4951234567' }}
        onRewriteChange={vi.fn()}
        charset="phone"
      />,
    );

    expandModifySection();

    expect(screen.getByText(/Из назначения/)).toBeInTheDocument();
    expect(screen.getAllByText('4951234567')).toHaveLength(2);
    expect(screen.queryByText('Свой пример')).not.toBeInTheDocument();
  });

  it('writes a single unconditional rule when adding a prefix', () => {
    const onRewriteChange = vi.fn();
    render(
      <DialModifyField
        source={{ source: 'fixed', value: '79001234567' }}
        onRewriteChange={onRewriteChange}
        charset="phone"
      />,
    );

    expandModifySection();
    fireEvent.change(screen.getByLabelText('Добавить в начало'), { target: { value: '8' } });

    const next = onRewriteChange.mock.calls.at(-1)?.[0];
    expect(next.rules).toHaveLength(1);
    expect(next.rules[0].transform.prefix).toBe('8');
  });

  it('lets the user switch between multiple route pattern samples', () => {
    render(
      <DialModifyField
        source={{ source: 'route_pattern' }}
        previewPatterns={['_7XXXXXXXXXX', '_8495XXXXXXX']}
        rewrite={{
          noMatch: 'passthrough',
          rules: [{ id: 'basic', enabled: true, conditions: [], transform: { prefix: '9' } }],
        }}
        onRewriteChange={vi.fn()}
        charset="phone"
      />,
    );

    fireEvent.click(screen.getByRole('option', { name: /_8495XXXXXXX/ }));
    expect(screen.getByText('984950000000')).toBeInTheDocument();
  });

  it('uses a long phone sample when the route extension is short', () => {
    render(
      <DialModifyField
        source={{ source: 'route_pattern' }}
        previewPatterns={['201']}
        rewrite={{
          noMatch: 'passthrough',
          rules: [{ id: 'basic', enabled: true, conditions: [], transform: { prefix: '8' } }],
        }}
        onRewriteChange={vi.fn()}
        charset="phone"
      />,
    );

    expect(screen.getByText(/Пример B-номера: 201 → 79001234567/)).toBeInTheDocument();
    expect(screen.getByText('879001234567')).toBeInTheDocument();
  });

  it('opens a custom sample input on demand', () => {
    render(
      <DialModifyField
        source={{ source: 'route_pattern' }}
        previewPatterns={['_7XXXXXXXXXX']}
        onRewriteChange={vi.fn()}
        charset="phone"
      />,
    );

    expandModifySection();
    fireEvent.click(screen.getByText('Свой пример'));
    expect(screen.getByLabelText('Пример номера')).toBeInTheDocument();
  });

  it('auto-opens expert mode when the rewrite has conditions', () => {
    render(
      <DialModifyField
        rewrite={{
          noMatch: 'passthrough',
          rules: [{ id: 'r1', enabled: true, conditions: [{ kind: 'startsWith', value: '7' }], transform: { prefix: '8' } }],
        }}
        onRewriteChange={vi.fn()}
        charset="phone"
      />,
    );

    expect(screen.getByLabelText('Экспертный режим')).toBeChecked();
    expect(screen.getByLabelText('Если правило не подошло')).toBeInTheDocument();
    expect(screen.queryByLabelText('Проверка')).not.toBeInTheDocument();
    expect(screen.getByText('Что уйдёт в набор')).toBeInTheDocument();
  });
});
