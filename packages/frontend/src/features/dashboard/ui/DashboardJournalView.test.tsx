import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardJournalView, parseDashboardJournalParams } from './DashboardJournalView';
const mocks = vi.hoisted(() => ({ entry: vi.fn(), query: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t:(key:string)=>key }) }));
vi.mock('@/shared/api/endpoints/dashboardApi', () => ({
  useGetDashboardOverviewQuery: (params:unknown) => { mocks.query(params); return { data:{ period:{ timezone:'UTC' } } }; },
}));
vi.mock('./DashboardDetailSheet', () => ({ DashboardRows: (props:unknown) => { mocks.entry(props); return <div data-testid="journal-rows" />; } }));
beforeEach(() => vi.clearAllMocks());
describe('full dashboard section filters', () => {
  it('preserves outcome, origin and live-state filters without legacy CDR aliases', () => {
    expect(parseDashboardJournalParams(new URLSearchParams('from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z&direction=in&outcome=accepted&origin=ai&state=talking&search=100'))).toEqual({
      period:'custom',from:'2026-10-01T00:00:00Z',to:'2026-10-02T00:00:00Z',direction:'in',outcome:'accepted',origin:'ai',state:'talking',search:'100',
    });
  });
  it('does not accept tenant identity or invalid enum values from URLs', () => {
    expect(parseDashboardJournalParams(new URLSearchParams('tenant=999&direction=bad&outcome=ANSWERED&origin=bad&state=bad&status=bad'))).toEqual({ period:'today' });
  });
  it.each(['endpoints','trunks'] as const)('reads bounded%s instead of legacy full-list services', (kind) => {
    render(<MemoryRouter initialEntries={['/'+kind+'?dashboard=1&status=offline&search=provider']}><DashboardJournalView kind={kind} /></MemoryRouter>);
    expect(screen.getByTestId('dashboard-journal')).toBeInTheDocument();
    expect(mocks.entry).toHaveBeenLastCalledWith(expect.objectContaining({
      entry:expect.objectContaining({ kind,filters:{ period:'today',status:'offline',search:'provider' } }), showSectionLink:false,
    }));
  });
});
