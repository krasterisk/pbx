import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { IAutodialBaseField } from '@krasterisk/shared';
import { emptyCampaignDraft } from '../../model/campaignDraft';
import { AutodialSpeechBuilder } from './AutodialSpeechBuilder';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({ useGetAutodialCapabilitiesQuery: () => ({ currentData: { tts_engines: [{ uid: 3, name: 'Russian speech' }] }, refetch: vi.fn() }) }));
const fields = [{ uid: 1, label: 'Name', type: 'string', var_name: 'AC_NAME' }, { uid: 2, label: 'Debt', type: 'money', var_name: 'AC_DEBT' }, { uid: 3, label: 'Date', type: 'date', var_name: 'AC_DATE' }] as IAutodialBaseField[];
describe('typed speech fields', () => {
  it('does not select a provider or turn a name into a money amount', () => {
    const change = vi.fn();
    render(<MemoryRouter><AutodialSpeechBuilder fields={fields} draft={emptyCampaignDraft()} onChange={change} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('autodial.workspace.sayField'), { target: { value: 'AC_NAME' } });
    expect(screen.getByLabelText('autodial.workspace.sayToken')).toHaveValue('{AC_NAME}');
    expect(within(screen.getByLabelText('autodial.workspace.sayFormat')).queryByRole('option', { name: 'autodial.workspace.sayKinds.money' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'autodial.workspace.addSay' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('autodial.workspace.sayEngine'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.addSay' }));
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ scenario_actions: [expect.objectContaining({ type: 'text2speech', params: { engine: 3, text: '{AC_NAME}', onFailure: 'hangup' } })] }));
  });
  it('selects the correct spoken suffix when moving between money and date fields', () => {
    render(<MemoryRouter><AutodialSpeechBuilder fields={fields} draft={emptyCampaignDraft()} onChange={vi.fn()} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('autodial.workspace.sayField'), { target: { value: 'AC_DEBT' } });
    expect(screen.getByLabelText('autodial.workspace.sayToken')).toHaveValue('{AC_DEBT_SAY_MONEY}');
    fireEvent.change(screen.getByLabelText('autodial.workspace.sayField'), { target: { value: 'AC_DATE' } });
    expect(screen.getByLabelText('autodial.workspace.sayToken')).toHaveValue('{AC_DATE_SAY_DATE}');
  });
});
