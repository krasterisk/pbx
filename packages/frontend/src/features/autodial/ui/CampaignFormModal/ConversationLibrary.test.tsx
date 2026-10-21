import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IAutodialBaseField } from '@krasterisk/shared';
import { ConversationLibrary } from './ConversationLibrary';
import { emptyCampaignDraft } from '../../model/campaignDraft';

const mocks = vi.hoisted(() => ({
  query: { currentData: { tts_engines: [{ uid: 3, name: 'Speech' }] }, isError: false, isFetching: false, refetch: vi.fn() },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({ useGetAutodialCapabilitiesQuery: () => mocks.query }));
const fields: IAutodialBaseField[] = [{ uid: 1, base_uid: 2, key: 'name', label: 'Name', type: 'string', var_name: 'AC_NAME', required: false, is_phone: false, position: 0 }];
beforeEach(() => {
  mocks.query.currentData = { tts_engines: [{ uid: 3, name: 'Speech' }] };
  mocks.query.isError = false; mocks.query.isFetching = false; vi.clearAllMocks();
});

describe('conversation speech readiness', () => {
  it('does not apply a speech template using retained catalog data after a failed refresh', () => {
    const draft = emptyCampaignDraft(), change = vi.fn(); draft.dial_mode = 'agentless';
    const view = render(<ConversationLibrary fields={fields} draft={draft} initialGoal="notification" onChange={change} />);
    fireEvent.change(screen.getByLabelText('autodial.workspace.library.fields.name'), { target: { value: 'AC_NAME' } });
    fireEvent.change(screen.getByLabelText('autodial.workspace.sayEngine'), { target: { value: '3' } });
    expect(screen.getByRole('button', { name: 'autodial.workspace.library.apply' })).toBeEnabled();
    mocks.query.isError = true;
    view.rerender(<ConversationLibrary fields={fields} draft={draft} initialGoal="notification" onChange={change} />);
    expect(screen.getByRole('button', { name: 'autodial.workspace.library.apply' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('autodial.common.loadFailed');
    expect(change).not.toHaveBeenCalled();
  });

  it('explains why no speech provider can be selected', () => {
    mocks.query.currentData = { tts_engines: [] };
    render(<ConversationLibrary fields={fields} draft={emptyCampaignDraft()} initialGoal="notification" onChange={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('autodial.workspace.library.noSpeechProviders');
    expect(screen.getByRole('button', { name: 'autodial.workspace.library.apply' })).toBeDisabled();
  });

  it('allows an operator-only conversation despite a speech catalog error', () => {
    mocks.query.isError = true;
    const draft = emptyCampaignDraft(); draft.queue_names = ['qsales_0'];
    const change = vi.fn();
    render(<ConversationLibrary fields={[]} draft={draft} initialGoal="operator" onChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.library.apply' }));
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ business_goal: 'operator' }));
  });
});
