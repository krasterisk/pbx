import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/shared/api/endpoints/serviceRequestApi', () => ({
  useGetServiceRequestStatsQuery: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/features/serviceRequests', () => ({
  ServiceRequestsTable: () => <div data-testid="service-requests-table-stub">table</div>,
  ServiceRequestsFilter: () => <div data-testid="service-requests-filter-stub">filter</div>,
  ServiceRequestsStats: () => <div data-testid="service-requests-stats-stub">stats</div>,
}));

import { ServiceRequestsPage } from './ServiceRequestsPage';

describe('ServiceRequestsPage hybrid overflow (D-29 / D-27 wave E)', () => {
  it('exposes hybrid-table overflow marker at page level', () => {
    render(<ServiceRequestsPage />);
    expect(screen.getByTestId('service-requests-page-responsive')).toBeInTheDocument();
    const hybrid = screen.getByTestId('hybrid-table');
    expect(hybrid).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(hybrid.className).toMatch(/overflow-x-auto/);
    expect(screen.getByTestId('service-requests-table-stub')).toBeInTheDocument();
  });
});
