import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fb?: string) => fb || _k }),
}));

vi.mock('@/shared/api/endpoints/komandorClaimApi', () => ({
  useGetKomandorClaimStatsQuery: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('@/features/komandorClaims', () => ({
  KomandorClaimsTable: () => <div data-testid="komandor-claims-table-stub">table</div>,
  KomandorClaimsFilter: () => <div data-testid="komandor-claims-filter-stub">filter</div>,
  KomandorClaimsStats: () => <div data-testid="komandor-claims-stats-stub">stats</div>,
}));

import { KomandorClaimsPage } from './KomandorClaimsPage';

describe('KomandorClaimsPage', () => {
  it('renders page chrome and table overflow marker', () => {
    render(<KomandorClaimsPage />);
    expect(screen.getByTestId('komandor-claims-page-responsive')).toBeInTheDocument();
    expect(screen.getByTestId('hybrid-table')).toHaveAttribute('data-hybrid', 'overflow-x-auto');
  });
});
