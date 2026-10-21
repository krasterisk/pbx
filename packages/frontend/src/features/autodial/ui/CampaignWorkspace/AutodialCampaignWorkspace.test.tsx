import { useEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutodialCampaignWorkspace } from './AutodialCampaignWorkspace';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  campaign: { uid: 18, base_uid: 2, name: 'Survey', status: 'draft', revision: 3, applied_revision: 3, tour_no: 0 },
  queryError: undefined as undefined | { status: number | string },
  notify: () => {},
  refetch: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/features/ai-chat/model/useAssistantContext', () => ({ useAssistantContext: vi.fn() }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialCampaignQuery: () => {
    const [, tick] = useState(0);
    mocks.notify = () => tick(value => value + 1);
    return { currentData: mocks.campaign, isError: Boolean(mocks.queryError), error: mocks.queryError, refetch: mocks.refetch };
  },
  useGetAutodialDiagnosisQuery: () => ({}),
  useSetAutodialCampaignStateMutation: () => [vi.fn(), {}],
  useUpdateAutodialCampaignMutation: () => [vi.fn(), {}],
}));
vi.mock('@/features/autodial/ui/CampaignWorkspace/CampaignConfiguration', () => ({
  CampaignConfiguration: function Draft({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
    const [value, setValue] = useState('saved outcome');
    useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
    return <input aria-label="Conversation draft" value={value} onChange={(event) => {
      setValue(event.target.value); onDirtyChange(true);
    }} />;
  },
}));
vi.mock('@/features/autodial/ui/CampaignWorkspace/ScenarioPreviewPanel', () => ({ ScenarioPreviewPanel: () => null }));
vi.mock('@/features/autodial/ui/CampaignWorkspace/PreflightChecklist', () => ({ PreflightChecklist: () => null }));
vi.mock('@/features/autodial/ui/CampaignWorkspace/CampaignJournal', () => ({ CampaignJournal: () => <p>Journal loaded</p> }));
vi.mock('@/features/autodial/ui/CampaignWorkspace/AutodialAiPrivacy', () => ({ AutodialAiPrivacy: () => null }));
vi.mock('@/features/autodial/ui/CampaignWorkspace/AutodialIntegrationKeys', () => ({ AutodialIntegrationKeys: () => null }));
vi.mock('@/features/autodial/ui/ContactsGrid/ContactsGrid', () => ({ ContactsGrid: () => null }));
vi.mock('@/features/autodial/ui/ContactFormModal/ContactFormModal', () => ({ ContactFormModal: () => null }));
vi.mock('@/features/autodial/ui/ImportWizard/ImportWizard', () => ({ ImportWizard: () => null }));
vi.mock('@/features/autodial/ui/BaseFormModal/BaseFormModal', () => ({ BaseFormModal: () => null }));
vi.mock('@/features/autodial/ui/StartCampaignDialog/StartCampaignDialog', () => ({ StartCampaignDialog: () => null }));
vi.mock('@/features/autodial/ui/ReportsView/ReportsView', () => ({ ReportsView: () => null }));
vi.mock('../AutodialAiAction/AutodialAiAction', () => ({ AutodialAiAction: () => null }));

function mount() {
  const router = createMemoryRouter([{ path: '/autodial/campaigns/:uid', element: <AutodialCampaignWorkspace /> }], {
    initialEntries: ['/autodial/campaigns/18?tab=scenario'],
  });
  render(<RouterProvider router={router} />);
  return router;
}

describe('campaign draft navigation', () => {
  beforeEach(() => { mocks.queryError = undefined; mocks.refetch.mockClear(); });

  it.each([429, 504, 'FETCH_ERROR'])('retains an edited draft after transient polling error %s and offers refresh', async (status) => {
    mount();
    fireEvent.change(screen.getByRole('textbox', { name: 'Conversation draft' }), { target: { value: 'unsaved draft' } });
    act(() => { mocks.queryError = { status }; mocks.notify(); });
    expect(screen.getByRole('textbox', { name: 'Conversation draft' })).toHaveValue('unsaved draft');
    expect(screen.getByRole('alert')).toHaveTextContent('autodial.workspace.refreshFailed');
    expect(screen.getByRole('button', { name: 'autodial.campaigns.start' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
    act(() => { mocks.queryError = undefined; mocks.notify(); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Conversation draft' })).toHaveValue('unsaved draft');
  });

  it.each([401, 403, 404])('hides cached campaign on access/missing response %s', (status) => {
    mount();
    act(() => { mocks.queryError = { status }; mocks.notify(); });
    expect(screen.queryByRole('textbox', { name: 'Conversation draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('autodial.common.loadFailed');
  });
  it('retains the draft after Cancel and Escape without reopening the dialog on focus return', async () => {
    const user = userEvent.setup(), router = mount();
    await user.type(screen.getByRole('textbox', { name: 'Conversation draft' }), ' edited');
    const journal = screen.getByRole('tab', { name: 'autodial.workspace.tabs.journal' });
    act(() => journal.focus());
    expect(screen.queryByRole('dialog', { name: 'common.confirm' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?tab=scenario');
    fireEvent.keyDown(journal, { key: 'Enter' });
    await screen.findByRole('dialog', { name: 'common.confirm' });
    await user.click(screen.getByRole('button', { name: 'common.cancel' }));
    await waitFor(() => expect(journal).toHaveFocus());
    expect(screen.queryByRole('dialog', { name: 'common.confirm' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?tab=scenario');
    expect(screen.getByRole('textbox', { name: 'Conversation draft' })).toHaveValue('saved outcome edited');

    fireEvent.keyDown(journal, { key: 'Enter' });
    await screen.findByRole('dialog', { name: 'common.confirm' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(journal).toHaveFocus());
    expect(screen.queryByRole('dialog', { name: 'common.confirm' })).not.toBeInTheDocument();
    expect(router.state.location.search).toBe('?tab=scenario');
    expect(screen.getByRole('textbox', { name: 'Conversation draft' })).toHaveValue('saved outcome edited');

    fireEvent.keyDown(journal, { key: 'Enter' });
    await screen.findByRole('dialog', { name: 'common.confirm' });
    await user.click(screen.getByRole('button', { name: 'common.confirm' }));
    await screen.findByText('Journal loaded');
    expect(router.state.location.search).toBe('?tab=journal');
    expect(screen.queryByRole('dialog', { name: 'common.confirm' })).not.toBeInTheDocument();
  });
});
