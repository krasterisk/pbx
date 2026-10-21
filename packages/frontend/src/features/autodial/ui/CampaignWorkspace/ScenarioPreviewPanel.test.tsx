import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScenarioPreviewPanel } from './ScenarioPreviewPanel';

const mocks = vi.hoisted(() => ({ call: vi.fn(), reconcile: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppSelector: () => ({ uniqueid: 4, vpbx_user_uid: 7 }) }));
vi.mock('./TestCallEvidence', () => ({ TestCallEvidence: ({ testUid }: { testUid: string }) => <div>known-test:{testUid}</div> }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialCampaignContactsQuery: () => ({ currentData: { items: [{ uid: 1, external_id: 'test-client', phones: [] }] } }),
  useGetAutodialScenarioPreviewQuery: () => ({ currentData: { variables: [], steps: [] } }),
  usePreviewAutodialAudioMutation: () => [vi.fn(), { isLoading: false }],
  useRequestAutodialTestCallMutation: () => [mocks.call, { isLoading: false }],
  useReconcileAutodialTestCallMutation: () => [mocks.reconcile, { isLoading: false }],
}));
beforeEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });
const mount = () => render(<MemoryRouter><ScenarioPreviewPanel uid={3} baseUid={2} revision={5} dirty={false} /></MemoryRouter>);

describe('test-call response loss', () => {
  it('recovers an admitted call after remount without another originate', async () => {
    mocks.call.mockReturnValue({ unwrap: async () => { throw { status: 504 }; } });
    const first = mount();
    fireEvent.change(screen.getByLabelText('autodial.workspace.previewContact'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.callMe' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'autodial.workspace.callMe' }));
    await screen.findByText('autodial.workspace.testPending');
    const sent = mocks.call.mock.calls[0][0];
    expect(sent).toMatchObject({ uid: 3, contact_uid: 1, expected_revision: 5 });
    first.unmount();
    mocks.reconcile.mockReturnValue({ unwrap: async () => ({ status: 'admitted', test: { uid: 'a1234567-1234-1234-1234-123456789abc' } }) });
    mount(); expect(screen.getByLabelText('autodial.workspace.previewContact')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.recheck' }));
    await waitFor(() => expect(screen.getByText('known-test:a1234567-1234-1234-1234-123456789abc')).toBeInTheDocument());
    expect(mocks.call).toHaveBeenCalledTimes(1);
    expect(mocks.reconcile).toHaveBeenCalledWith({ uid: 3, key: sent.idempotency_key });
    expect(sessionStorage.getItem('autodial:test:7:4:3')).toBeNull();
  });
});
