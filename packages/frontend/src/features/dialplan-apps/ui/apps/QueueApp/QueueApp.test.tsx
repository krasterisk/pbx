import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueueApp } from './QueueApp';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({
    data: [{ name: 'qsales_42', exten: 'sales', display_name: 'Sales' }],
    isLoading: false,
  }),
}));

vi.mock('@/shared/api/endpoints/promptsApi', () => ({
  useGetPromptsQuery: () => ({
    data: [{ uid: 1, filename: 'vip-welcome', comment: 'VIP' }],
    isLoading: false,
  }),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: () => ({ data: [], isLoading: false }),
}));

describe('QueueApp', () => {
  it('renders priority and announceoverride and patches only priority', () => {
    const onChange = vi.fn();
    render(
      <QueueApp
        params={{ target: { source: 'fixed', value: 'sales' }, priority: 1 }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText('Приоритет')).toBeInTheDocument();
    expect(screen.getByLabelText('Приветствие очереди')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Приоритет'), { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith({ priority: 7 });
  });
});
