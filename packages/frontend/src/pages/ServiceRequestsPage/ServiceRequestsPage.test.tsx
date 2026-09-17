import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
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

describe('ServiceRequestsPage', () => {
  it('renders title, subtitle, stats, filter and table', () => {
    render(<ServiceRequestsPage />);

    expect(screen.getByTestId('service-requests-page-responsive')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'serviceRequests.title' })).toBeInTheDocument();
    expect(screen.getByText('serviceRequests.subtitle')).toBeInTheDocument();
    expect(screen.getByTestId('service-requests-stats-stub')).toBeInTheDocument();
    expect(screen.getByTestId('service-requests-filter-stub')).toBeInTheDocument();
    expect(screen.getByTestId('service-requests-table-stub')).toBeInTheDocument();
  });
});
