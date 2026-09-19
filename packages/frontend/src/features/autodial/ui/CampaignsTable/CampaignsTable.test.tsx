import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CampaignsTable } from './CampaignsTable';

const mocks = vi.hoisted(() => ({
  deleteCampaign: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialCampaignsQuery: () => ({
    data: [{ uid: 11, name: 'Renewal', status: 'stopped', dial_mode: 'agentless', base_uid: 2, queue_names: [] }],
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useGetAutodialBasesQuery: () => ({ data: [] }),
  useDeleteAutodialCampaignMutation: () => [mocks.deleteCampaign, { isLoading: false }],
  useSetAutodialCampaignStateMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock('../../lib/useAutodialSse', () => ({
  useAutodialSse: () => ({ status: 'connected', runtimes: {} }),
}));
vi.mock('../StartCampaignDialog/StartCampaignDialog', () => ({ StartCampaignDialog: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CampaignsTable deletion', () => {
  it('keeps the dialog open and shows an active-call error when deletion fails', async () => {
    mocks.deleteCampaign.mockReturnValue({
      unwrap: () => Promise.reject({ data: { code: 'AC_CAMPAIGN_ACTIVE_CALLS' } }),
    });
    render(<CampaignsTable />);

    fireEvent.click(within(screen.getByTestId('autodial-campaign-card')).getByRole('button', { name: 'common.delete' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'common.delete' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('autodial.errors.AC_CAMPAIGN_ACTIVE_CALLS');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(mocks.deleteCampaign).toHaveBeenCalledWith(11);
  });

  it('closes the dialog only after deletion succeeds', async () => {
    mocks.deleteCampaign.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    render(<CampaignsTable />);

    fireEvent.click(within(screen.getByTestId('autodial-campaign-card')).getByRole('button', { name: 'common.delete' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'common.delete' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
