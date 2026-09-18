import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContactFormModal } from './ContactFormModal';

const mocks = vi.hoisted(() => ({
  base: vi.fn(), contact: vi.fn(), create: vi.fn(), update: vi.fn(), dispatch: vi.fn(),
  state: { autodialPage: { isContactModalOpen: true, selectedContactUid: 61 as number | null } },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
}));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialBaseQuery: mocks.base,
  useGetAutodialContactQuery: mocks.contact,
  useCreateAutodialContactMutation: () => [mocks.create, { isLoading: false }],
  useUpdateAutodialContactMutation: () => [mocks.update, { isLoading: false }],
}));
const base = {
  uid: 1, fields: [
    { uid: 11, key: 'name', label: 'Name', type: 'string', required: true, position: 0, is_phone: false },
    { uid: 12, key: 'phone', label: 'Phone', type: 'phone', required: true, position: 1, is_phone: true },
  ],
};
const contact = {
  uid: 61, base_uid: 1, values: { name: 'Alice' }, comment: 'before', external_id: 'external',
  phones: [{ uid: 51, raw: '79001234567', normalized: '79001234567', is_primary: true, tz_offset_min: 180 }],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.autodialPage.isContactModalOpen = true;
  mocks.state.autodialPage.selectedContactUid = 61;
  mocks.base.mockReturnValue({ currentData: base, isError: false, refetch: vi.fn() });
  mocks.contact.mockReturnValue({ currentData: contact, isError: false, refetch: vi.fn() });
  mocks.update.mockReturnValue({ unwrap: () => Promise.resolve(contact) });
});

describe('ContactFormModal request and draft boundaries', () => {
  it('loads an individual contact and preserves phone UID when clearing text', async () => {
    render(<ContactFormModal baseUid={1} />);
    expect(await screen.findByDisplayValue('Alice')).toBeInTheDocument();
    expect(mocks.contact).toHaveBeenCalledWith({ baseUid: 1, contactUid: 61 }, { skip: false });
    fireEvent.change(screen.getByLabelText('autodial.contacts.comment'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('autodial.contacts.externalId'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({
      baseUid: 1, contactUid: 61,
      data: { values: { name: 'Alice' }, comment: '', external_id: null, phones: [{ uid: 51, raw: '79001234567', is_primary: true, tz_offset_min: 180 }] },
    }));
  });
  it('does not overwrite local edits after a background refetch', async () => {
    const view = render(<ContactFormModal baseUid={1} />);
    fireEvent.change(await screen.findByDisplayValue('Alice'), { target: { value: 'My draft' } });
    mocks.contact.mockReturnValue({ currentData: { ...contact, values: { name: 'Server change' } }, isError: false });
    view.rerender(<ContactFormModal baseUid={1} />);
    expect(screen.getByDisplayValue('My draft')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Server change')).not.toBeInTheDocument();
  });
  it('cannot save while the requested contact is loading', () => {
    mocks.contact.mockReturnValue({ currentData: undefined, isError: false });
    render(<ContactFormModal baseUid={1} />);
    expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('does not carry a previous detail error into a new-contact session', () => {
    mocks.state.autodialPage.selectedContactUid = null;
    mocks.contact.mockReturnValue({ currentData: undefined, isError: true });
    render(<ContactFormModal baseUid={1} />);
    expect(mocks.contact).toHaveBeenCalledWith({ baseUid: 1, contactUid: 0 }, { skip: true });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.save' })).toBeEnabled();
  });
  it('renders a load error and retry instead of allowing an empty save', () => {
    const refetch = vi.fn();
    mocks.contact.mockReturnValue({ currentData: undefined, isError: true, refetch });
    render(<ContactFormModal baseUid={1} />);
    expect(screen.getByRole('alert')).toHaveTextContent('autodial.common.loadFailed');
    fireEvent.click(screen.getByRole('button', { name: 'autodial.common.retry' }));
    expect(refetch).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'common.save' })).toBeDisabled();
  });
  it('keeps the draft and displays a localized dependency error on save failure', async () => {
    mocks.update.mockReturnValue({ unwrap: () => Promise.reject({ data: { code: 'AC_PHONE_IN_USE' } }) });
    render(<ContactFormModal baseUid={1} />);
    expect(await screen.findByDisplayValue('Alice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(await screen.findByText('autodial.errors.AC_PHONE_IN_USE')).toBeInTheDocument();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
  });
});
