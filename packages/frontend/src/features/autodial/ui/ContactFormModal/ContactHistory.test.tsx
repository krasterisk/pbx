import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ContactHistory } from './ContactHistory';

const mocks = vi.hoisted(() => ({ history: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en' }, t: (key: string, values?: { count?: number }) => key === 'autodial.workspace.durationSeconds' ? `${values?.count} s` : key }) }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialContactHistoryQuery: mocks.history,
  useGetAutodialReportContextQuery: () => ({ currentData: { timezone: 'UTC' } }),
}));
describe('customer history', () => {
  it('shows the frozen business result alongside the short technical result and next task', () => {
    mocks.history.mockReturnValue({ currentData: { attempts: [{ uid: 1, campaign_uid: 2, campaign_name: 'Appointment',
      started_at: '2026-10-18T00:00:00Z', ended_at: '2026-10-18T00:00:13Z', disposition: 'answered_short', billsec: 13,
      outcome: 'Original confirmation label', goal_relation: 'achieved' }], tasks: [{ uid: 1, campaign_uid: 2, campaign_name: 'Appointment', status: 'completed', next_attempt_at: null }], truncated: false, limit: 50 } });
    render(<MemoryRouter><ContactHistory baseUid={4} contactUid={7} /></MemoryRouter>);
    expect(screen.getByText(/Original confirmation label/)).toHaveTextContent('autodial.workspace.outcomeDefinition.relations.achieved');
    expect(screen.getByText(/autodial.disposition.answered_short/)).toHaveTextContent('13');
    expect(screen.getAllByText('autodial.workspace.contactHistory.noNext').length).toBeGreaterThan(0);
    expect(mocks.history).toHaveBeenCalledWith({ baseUid: 4, contactUid: 7 }, { refetchOnMountOrArgChange: true });
  });
  it('never displays the previous customer while a different customer is loading', () => {
    mocks.history.mockReturnValue({ currentData: undefined, data: { attempts: [{ outcome: 'Previous customer' }] }, isFetching: true });
    render(<MemoryRouter><ContactHistory baseUid={4} contactUid={8} /></MemoryRouter>);
    expect(screen.queryByText('Previous customer')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('common.loading');
  });
});
