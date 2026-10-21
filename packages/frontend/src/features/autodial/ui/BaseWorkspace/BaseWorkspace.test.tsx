import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { BaseWorkspace } from './BaseWorkspace';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('../BasesList/BasesList', () => ({ BasesList: ({ onOpen }: { onOpen: (uid: number) => void }) => <button onClick={() => onOpen(7)}>Open base7</button> }));
vi.mock('../ContactsGrid/ContactsGrid', () => ({ ContactsGrid: ({ baseUid }: { baseUid: number }) => <p>Contacts of base{baseUid}</p> }));
vi.mock('../BaseFormModal/BaseFormModal', () => ({ BaseFormModal: () => null }));
vi.mock('../ContactFormModal/ContactFormModal', () => ({ ContactFormModal: () => null }));
vi.mock('../ImportWizard/ImportWizard', () => ({ ImportWizard: () => null }));
vi.mock('../DncPanel/DncPanel', () => ({ DncPanel: () => null }));
vi.mock('./BaseIntegrationGuide', () => ({ BaseIntegrationGuide: () => null }));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialBaseQuery: (uid: number) => ({ currentData: { uid, name: `Base${uid}`, description: '', revision: 1, fields: [
    { uid: 41, key: 'name', label: 'Customer name', type: 'string', position: 0, is_phone: false },
    { uid: 42, key: 'score', label: 'Score', type: 'number', position: 1, is_phone: false },
    { uid: 43, key: 'active', label: 'Active', type: 'boolean', position: 2, is_phone: false },
  ] }, isError: false, isLoading: false }),
  useGetAutodialBasesQuery: () => ({ currentData: [{ uid: 7, name: 'Base7' }, { uid: 8, name: 'Base8' }] }),
  useGetAutodialFieldUsageQuery: () => ({ currentData: { fields: [] } }),
  useGetAutodialContactsQuery: () => ({ currentData: { items: [{ values: { name: 'Synthetic customer', score: 0, active: false }, phones: [] }] } }),
  useGetAutodialImportProfilesQuery: () => ({ currentData: [] }),
  useGetAutodialImportRunsQuery: () => ({ currentData: [] }),
}));
function Location() { return <output data-testid="location">{useLocation().search}</output>; }
const mount = (url: string) => render(<MemoryRouter initialEntries={[url]}><BaseWorkspace /><Location /></MemoryRouter>);

describe('full width base workspace navigation', () => {
  it('opens the requested Fields tab and separates it from contacts', () => {
    mount('/autodial/bases?base=7&tab=fields');
    expect(screen.getByRole('tab', { name: 'autodial.workspace.baseTabs.fields' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Customer name')).toBeInTheDocument();
    expect(screen.getByText('autodial.workspace.fieldExample: Synthetic customer')).toBeInTheDocument();
    expect(screen.getByText('autodial.workspace.fieldExample: 0')).toBeInTheDocument();
    expect(screen.getByText('autodial.workspace.fieldExample: common.no')).toBeInTheDocument();
    expect(screen.queryByText('Contacts of base7')).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'autodial.workspace.baseTabs.clients' }), { button: 0, ctrlKey: false });
    expect(screen.getByText('Contacts of base7')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('base=7&tab=clients');
  });
  it('returns to the catalogue and switches base without inheriting the previous contacts', () => {
    mount('/autodial/bases');
    fireEvent.click(screen.getByRole('button', { name: 'Open base7' }));
    expect(screen.getByText('Contacts of base7')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('autodial.workspace.switchBase'), { target: { value: '8' } });
    expect(screen.getByText('Contacts of base8')).toBeInTheDocument();
    expect(screen.queryByText('Contacts of base7')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.backToBases' }));
    expect(screen.getByRole('button', { name: 'Open base7' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toBeEmptyDOMElement();
  });
});
