import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DialTargetRewriteEditor } from './DialTargetRewriteEditor';

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

vi.mock('@/shared/api/endpoints/endpointApi', () => ({
  useGetEndpointsQuery: () => ({ data: [], isLoading: false }),
}));

describe('DialTargetRewriteEditor', () => {
  it('creates a rule and updates prefix with live preview', () => {
    const onRewriteChange = vi.fn();
    const { rerender } = render(
      <DialTargetRewriteEditor rewrite={{ rules: [], noMatch: 'passthrough' }} onRewriteChange={onRewriteChange} />,
    );

    fireEvent.click(screen.getByText('Добавить правило'));
    expect(onRewriteChange).toHaveBeenCalled();
    const next = onRewriteChange.mock.calls[0][0];
    expect(next.rules).toHaveLength(1);

    rerender(<DialTargetRewriteEditor rewrite={next} onRewriteChange={onRewriteChange} />);
    fireEvent.change(screen.getByLabelText('Добавить префикс'), { target: { value: '8' } });
    const withPrefix = onRewriteChange.mock.calls.at(-1)?.[0];
    expect(withPrefix.rules[0].transform.prefix).toBe('8');

    rerender(<DialTargetRewriteEditor rewrite={withPrefix} onRewriteChange={onRewriteChange} />);
    expect(screen.getByText('879001234567')).toBeInTheDocument();
    expect(screen.getByText('Сработало правило 1')).toBeInTheDocument();
  });

  it('adds a startsWith condition and switches no-match policy', () => {
    const onRewriteChange = vi.fn();
    render(
      <DialTargetRewriteEditor
        rewrite={{
          noMatch: 'passthrough',
          rules: [{ id: 'r1', enabled: true, conditions: [], transform: {} }],
        }}
        onRewriteChange={onRewriteChange}
      />,
    );

    fireEvent.click(screen.getByText('Добавить условие'));
    expect(onRewriteChange.mock.calls.at(-1)?.[0].rules[0].conditions[0].kind).toBe('startsWith');

    fireEvent.change(screen.getByLabelText('Если правило не подошло'), { target: { value: 'reject' } });
    expect(onRewriteChange.mock.calls.at(-1)?.[0].noMatch).toBe('reject');
  });

  it('renders ValueSource when showSource is on', () => {
    const onSourceChange = vi.fn();
    render(
      <DialTargetRewriteEditor
        showSource
        source={{ source: 'route_pattern' }}
        onSourceChange={onSourceChange}
        rewrite={{ rules: [] }}
        onRewriteChange={vi.fn()}
      />,
    );
    expect(screen.getByText('B-номер маршрута')).toBeInTheDocument();
  });
});
