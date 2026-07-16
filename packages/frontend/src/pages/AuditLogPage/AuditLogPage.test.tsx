import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@/features/audit-log', () => ({
  AuditLogStats: () => <div data-testid="audit-stats-stub">stats</div>,
  AuditLogFilter: () => <div data-testid="audit-filter-stub">filter</div>,
  AuditLogTable: () => <div data-testid="audit-table-stub">table</div>,
  WebhookFailuresTable: () => <div data-testid="webhook-table-stub">webhooks</div>,
  useGetAuditLogsQuery: () => ({ data: { items: [], total: 0 }, isLoading: false, isFetching: false }),
  useGetAuditLogStatsQuery: () => ({ data: undefined, isLoading: false }),
  useGetWebhookFailuresQuery: () => ({ data: { items: [], total: 0 }, isLoading: false }),
}));

import AuditLogPage from './AuditLogPage';

describe('AuditLogPage hybrid overflow (D-29 / D-27 wave D)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<AuditLogPage />);
    expect(screen.getByTestId('audit-log-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('audit-table-stub')).toBeInTheDocument();
  });
});
