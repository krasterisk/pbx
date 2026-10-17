import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { CcSettingsOverview } from './CcSettingsOverview';

const state = vi.hoisted(() => ({ loading: true, error: false, refetch: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }) }));
vi.mock('@/shared/api/endpoints/callCenterApi', () => {
  const query = () => ({ data: undefined, isLoading: state.loading, isError: state.error, refetch: state.refetch });
  return { useGetPauseReasonsQuery: query, useGetTenantSettingsQuery: query, useListDisplayTokensQuery: query, useGetCardTemplatesQuery: query };
});
vi.mock('@/shared/api/endpoints/callCenterReportsApi', () => ({ useGetReportSchedulesQuery: () => ({ data: undefined, isLoading: state.loading, isError: state.error, refetch: state.refetch }) }));

describe('CcSettingsOverview unavailable data', () => {
  beforeEach(() => { state.loading = true; state.error = false; state.refetch.mockClear(); });

  it('does not report thresholds or hotkeys as configured while settings are unknown', () => {
    render(<MemoryRouter><CcSettingsOverview /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Checking call center readiness');
    expect(screen.queryByTestId('cc-readiness-thresholds')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cc-readiness-hotkeys')).not.toBeInTheDocument();
  });

  it('explains failed checks and retries all readiness sources', () => {
    state.loading = false; state.error = true;
    render(<MemoryRouter><CcSettingsOverview /></MemoryRouter>);
    expect(screen.getByRole('alert')).toHaveTextContent('readiness is unknown');
    expect(screen.queryByTestId('cc-readiness-thresholds')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.refetch).toHaveBeenCalledTimes(5);
  });
});
