import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CampaignCreationWizard } from './CampaignCreationWizard';
import { emptyCampaignDraft, type AutodialCampaignDraft } from '../../model/campaignDraft';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: () => null }));
vi.mock('@/shared/api/endpoints/queueApi', () => ({ useGetQueuesQuery: () => ({ data: [] }) }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({ useCheckAutodialDraftMutation: () => [
  () => ({ unwrap: () => Promise.resolve({ ready: true }) }),
  { data: { ready: true, eligible_numbers: 1, checks: [], checked_at: '2026-10-16T00:00:00Z' }, reset: () => undefined },
] }));
vi.mock('../BaseFormModal/BaseFormModal', () => ({ BaseFormModal: () => null }));
vi.mock('../ImportWizard/ImportWizard', () => ({ ImportWizard: () => null }));
vi.mock('./CampaignGeneralTab', () => ({ CampaignGeneralTab: ({ section }: { section: string }) => <span>{section}</span> }));
vi.mock('./CampaignPacingTab', () => ({ CampaignPacingTab: () => null }));
vi.mock('./CampaignTrunksTab', () => ({ CampaignTrunksTab: ({ draft, onChange }: { draft: AutodialCampaignDraft; onChange: (draft: AutodialCampaignDraft) => void }) =>
  <button onClick={() => onChange({ ...draft, trunk_pool: [{ trunk_id: 'selected-test-route' }] })}>choose test route</button> }));
vi.mock('./CampaignScheduleTab', () => ({ CampaignScheduleTab: () => null }));
vi.mock('./CampaignRetryTab', () => ({ CampaignRetryTab: () => null }));
vi.mock('./CampaignScenarioTab', () => ({ CampaignScenarioTab: ({ draft, onChange }: { draft: AutodialCampaignDraft; onChange: (draft: AutodialCampaignDraft) => void }) =>
  <button onClick={() => onChange({ ...draft, success_min_sec: draft.success_min_sec + 1 })}>change scenario</button> }));

function Fixture({ save, valid = true, emptyRoute = false }: { save: (start?: boolean) => Promise<void>; valid?: boolean; emptyRoute?: boolean }) {
  const [draft, setDraft] = useState<AutodialCampaignDraft>({ ...emptyCampaignDraft(), name: valid ? 'UAT' : '',
    base_uid: valid ? 1 : null, dial_mode: 'agentless', trunk_pool: emptyRoute ? [] : [{ trunk_id: 'test' }], scenario_actions: [{ id: 'end', type: 'hangup', params: {}, condition: {} }] });
  return <CampaignCreationWizard draft={draft} onChange={setDraft} onSave={save} onClose={() => undefined} saving={false} apiError={null} />;
}

describe('campaign wizard readiness', () => {
  it('keeps route settings visible after choosing a trunk', () => {
    render(<Fixture save={vi.fn()} emptyRoute />);
    fireEvent.click(screen.getByRole('button', { name: '4. autodial.workspace.wizard.rules' }));
    const choose = screen.getByRole('button', { name: 'choose test route' });
    expect(choose).toBeVisible();
    fireEvent.click(choose);
    expect(choose).toBeVisible();
  });
  it('requires a current preflight before opening launch and invalidates it after an edit', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<Fixture save={save} />);
    fireEvent.click(screen.getByRole('button', { name: '5. autodial.workspace.wizard.review' }));
    expect(screen.getByRole('button', { name: 'autodial.workspace.createAndStart' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.preflight' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'autodial.workspace.createAndStart' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.createAndStart' }));
    expect(save).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: '3. autodial.workspace.wizard.conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'change scenario' }));
    fireEvent.click(screen.getByRole('button', { name: '5. autodial.workspace.wizard.review' }));
    expect(screen.getByRole('button', { name: 'autodial.workspace.createAndStart' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.saveDraft' }));
    expect(save).toHaveBeenLastCalledWith(false);
  });
  it('takes an invalid final save back to the audience step without writing', () => {
    const save = vi.fn();
    render(<Fixture save={save} valid={false} />);
    fireEvent.click(screen.getByRole('button', { name: '5. autodial.workspace.wizard.review' }));
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.saveDraft' }));
    expect(screen.getByRole('button', { name: '2. autodial.workspace.wizard.audience' })).toHaveAttribute('aria-current', 'step');
    expect(save).not.toHaveBeenCalled();
  });
});
