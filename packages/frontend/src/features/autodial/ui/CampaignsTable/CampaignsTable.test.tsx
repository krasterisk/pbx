import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CampaignsTable } from './CampaignsTable';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  deleteCampaign: vi.fn(),
  dispatch: vi.fn(),
  monitorError: false,
  metrics: [{ campaign_uid: 11, dials_today: 2, success_today: 1, contact_rate: 50, eta_seconds: 100 }],
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', async (original) => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => vi.fn() }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialMonitorQuery: () => ({ data: mocks.metrics, isError: mocks.monitorError }),
  useGetAutodialCampaignsQuery: () => ({
    data: [{ uid: 11, name: 'Renewal', status: 'stopped', dial_mode: 'agentless', base_uid: 2, queue_names: [] }],
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useGetAutodialBasesQuery: () => ({ data: [] }),
  useDeleteAutodialCampaignMutation: () => [mocks.deleteCampaign, { isLoading: false }],
  useSetAutodialCampaignStateMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock('../../lib/useAutodialSse', () => ({
  useAutodialSse: () => ({ status: 'open', runtimes: {} }),
}));
vi.mock('../StartCampaignDialog/StartCampaignDialog', () => ({ StartCampaignDialog: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.monitorError = false;
});

describe('CampaignsTable deletion', () => {
  it('gives mobile users separate navigation and lifecycle controls without a technical-rate wall', () => {
    render(<MemoryRouter><CampaignsTable /></MemoryRouter>);
    const card = screen.getByTestId('autodial-campaign-card');
    expect(card).not.toHaveAttribute('role', 'button');
    expect(within(card).getByRole('button', { name: 'Renewal' })).toBeEnabled();
    expect(within(card).getByRole('button', { name: 'autodial.campaigns.start' })).toBeEnabled();
    expect(within(card).getByRole('button', { name: 'autodial.campaigns.stop' })).toBeDisabled();
    expect(within(card).getByText('autodial.workspace.progress')).toBeInTheDocument();
    expect(within(card).getByText('2')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Contact rate');
    expect(card).not.toHaveTextContent('ETA');
    expect(card).not.toHaveTextContent('autodial.workspace.successRate');
  });

  it('does not present a retained monitor count as current after polling fails', () => {
    mocks.monitorError = true;
    render(<MemoryRouter><CampaignsTable /></MemoryRouter>);
    const card = screen.getByTestId('autodial-campaign-card');
    expect(within(card).getByText('—')).toBeInTheDocument();
    expect(within(card).queryByText('2')).not.toBeInTheDocument();
  });

  it('keeps the dialog open and shows an active-call error when deletion fails', async () => {
    mocks.deleteCampaign.mockReturnValue({
      unwrap: () => Promise.reject({ data: { code: 'AC_CAMPAIGN_ACTIVE_CALLS' } }),
    });
    render(<MemoryRouter><CampaignsTable /></MemoryRouter>);

    fireEvent.click(within(screen.getByTestId('autodial-campaign-card')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'common.deleteSelected' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'common.delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('autodial.errors.AC_CAMPAIGN_ACTIVE_CALLS');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.deleteCampaign).toHaveBeenCalledWith(11);
  });

  it('closes the dialog only after deletion succeeds', async () => {
    mocks.deleteCampaign.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    render(<MemoryRouter><CampaignsTable /></MemoryRouter>);

    fireEvent.click(within(screen.getByTestId('autodial-campaign-card')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'common.deleteSelected' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'common.delete' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
