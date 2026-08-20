import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfBridgeApp } from './ConfBridgeApp';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/queueApi', () => ({
  useGetQueuesQuery: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: () => ({ data: [], isLoading: false }),
}));

describe('ConfBridgeApp', () => {
  it('renders room and options, and never shows PIN / profile / recording stubs', () => {
    render(
      <ConfBridgeApp
        params={{ room: { source: 'fixed', value: '100' } }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/комнат/i)).toBeInTheDocument();
    expect(screen.getByText('Опции')).toBeInTheDocument();
    expect(screen.queryByLabelText(/PIN/i)).toBeNull();
    expect(screen.queryByLabelText(/профил/i)).toBeNull();
    expect(screen.queryByLabelText(/profile/i)).toBeNull();
    expect(screen.queryByLabelText(/admin-marked/i)).toBeNull();
    expect(screen.queryByLabelText(/запис/i)).toBeNull();
    expect(screen.queryByLabelText(/record/i)).toBeNull();
    expect(screen.queryByLabelText(/DTMF/i)).toBeNull();
  });

  it('marks an empty required room aria-invalid before submit', () => {
    render(
      <ConfBridgeApp
        params={{ room: { source: 'fixed', value: '' } }}
        onChange={vi.fn()}
      />,
    );
    expect(document.querySelector('[aria-invalid="true"]')).not.toBeNull();
  });
});
