import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyCampaignDraft } from '../../model/campaignDraft';
import { ReportSelection } from './ReportSelection';

const mocks = vi.hoisted(() => ({ copy: vi.fn(), draft: vi.fn(), navigate: vi.fn(), dispatch: vi.fn(), resetPreview: vi.fn(), created: undefined as { uid: number; name: string } | undefined }));
const source = { ...emptyCampaignDraft(), uid: 1, user_uid: 9, status: 'completed', revision: 4, name: 'Source', base_uid: 7,
  schedules: [{ uid: 5, campaign_uid: 1, kind: 'weekly', weekday: 1, time_from: '09:00', time_to: '18:00', timezone: 'Asia/Krasnoyarsk', date_from: null, date_to: null, enabled: true }] };
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', async () => ({ ...await vi.importActual('react-router-dom'), useNavigate: () => mocks.navigate }));
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: { uniqueid: 4, vpbx_user_uid: 71 } } }),
  useAppDispatch: () => mocks.dispatch,
}));
vi.mock('@/entities/User', () => ({ selectUserLevel: () => 3 }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  autodialApi: { util: { invalidateTags: (tags: unknown) => ({ invalidate: tags }) }, endpoints: { checkAutodialUiCommand: { initiate: (id: string) => ({ id }) } } },
  usePreviewAutodialSelectionBaseMutation: () => [vi.fn(), { data: { contact_count: 2, preview_hash: 'checked' }, isLoading: false, reset: mocks.resetPreview }],
  useCreateAutodialSelectionBaseMutation: () => [mocks.copy, { data: mocks.created, isLoading: false }],
  useCreateAutodialCampaignMutation: () => [mocks.draft, { isLoading: false }],
  useGetAutodialCampaignQuery: () => ({ currentData: source }),
}));
beforeEach(() => {
  sessionStorage.clear(); vi.clearAllMocks(); mocks.created = undefined;
  mocks.copy.mockImplementation(() => ({ unwrap: async () => { mocks.created = { uid: 8, name: 'Follow up' }; return mocks.created; } }));
  mocks.draft.mockReturnValue({ unwrap: async () => ({ uid: 2 }) });
});
const mount = () => {
  const view = render(<MemoryRouter><ReportSelection filter={{ from: '2026-10-18', to: '2026-10-18', campaign_uids: [1], dimension: 'business_outcome', value: 'visit_confirmed' }} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('autodial.workspace.selectionName'), { target: { value: 'Follow up' } });
  fireEvent.click(screen.getByLabelText('autodial.workspace.redialAcknowledge'));
  return view;
};
describe('report selection draft creation', () => {
  it('allows a fresh selection only after a known base copy, without starting or deleting anything', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.selectionCreateBase' }));
    fireEvent.click(await screen.findByRole('button', { name: 'autodial.workspace.selectionNew' }));
    expect(mocks.resetPreview).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('autodial.workspace.selectionName')).toHaveValue('');
    expect(screen.getByLabelText('autodial.workspace.redialAcknowledge')).not.toBeChecked();
    expect(mocks.copy).toHaveBeenCalledTimes(1);
    expect(mocks.draft).not.toHaveBeenCalled();
  });
  it('uses a write DTO without stored schedule IDs and preserves the configured time window', async () => {
    mount(); fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.selectionCreateDraft' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/autodial/campaigns/2?tab=settings&start=1'));
    expect(mocks.draft).toHaveBeenCalledWith(expect.objectContaining({ name: 'Follow up', base_uid: 8,
      schedules: [{ kind: 'weekly', weekday: 1, time_from: '09:00', time_to: '18:00', timezone: 'Asia/Krasnoyarsk', date_from: null, date_to: null, enabled: true }] }));
    expect(mocks.draft.mock.calls[0][0]).not.toHaveProperty('user_uid');
  });
  it('reuses the created base when draft creation fails and is retried', async () => {
    mocks.draft.mockReturnValueOnce({ unwrap: async () => { throw new Error('Temporary failure'); } });
    mount(); fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.selectionCreateDraft' }));
    await screen.findByRole('alert');
    expect(mocks.copy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.selectionCreateDraft' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.copy).toHaveBeenCalledTimes(1);
    expect(mocks.draft).toHaveBeenCalledTimes(2);
  });
  it('reconciles a lost create response without creating another base or campaign', async () => {
    mocks.draft.mockReturnValueOnce({ unwrap: async () => { throw { status: 504 }; } });
    mocks.dispatch.mockReturnValue({ unwrap: async () => ({ status: 'completed', operation: 'create_campaign', resource_uid: 2 }), reset: vi.fn() });
    mount(); fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.selectionCreateDraft' }));
    fireEvent.click(await screen.findByRole('button', { name: 'autodial.workspace.commandCheck' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/autodial/campaigns/2?tab=settings'));
    expect(mocks.copy).toHaveBeenCalledTimes(1);
    expect(mocks.draft).toHaveBeenCalledTimes(1);
  });
  it('reconciles a lost base-copy response across remount without starting a campaign', async () => {
    mocks.copy.mockReturnValueOnce({ unwrap: async () => { throw { status: 504 }; } });
    mocks.dispatch.mockReturnValue({ unwrap: async () => ({ status: 'completed', operation: 'create_base', resource_uid: 8 }), reset: vi.fn() });
    const first = mount();
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.selectionCreateDraft' }));
    await screen.findByRole('button', { name: 'autodial.workspace.commandCheck' });
    const original = mocks.copy.mock.calls[0][0];
    first.unmount(); mount();
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.commandCheck' }));
    await screen.findByRole('link', { name: 'autodial.workspace.selectionCreated' });
    expect(mocks.copy).toHaveBeenCalledTimes(1);
    expect(mocks.draft).not.toHaveBeenCalled();
    expect(original.ui_command_id).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.selectionCreateDraft' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.copy).toHaveBeenCalledTimes(1);
  });
  it('retries an unknown base command with the original payload and identity', async () => {
    mocks.copy.mockReturnValueOnce({ unwrap: async () => { throw { status: 'TIMEOUT_ERROR' }; } });
    const first = mount();
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.selectionCreateBase' }));
    await screen.findByRole('button', { name: 'autodial.workspace.commandCheck' });
    const original = mocks.copy.mock.calls[0][0];
    first.unmount(); mount();
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.selectionCreateBase' }));
    await screen.findByRole('link', { name: 'autodial.workspace.selectionCreated' });
    expect(mocks.copy.mock.calls[1][0]).toEqual(original);
    expect(mocks.draft).not.toHaveBeenCalled();
  });
});
