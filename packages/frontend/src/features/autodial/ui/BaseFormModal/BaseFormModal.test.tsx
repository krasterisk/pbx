import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BaseFormModal } from './BaseFormModal';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  base: { uid: 30, name: 'Appointments', description: '', revision: 2, dedup_policy: 'phone', phone_normalization: 'ru_8_to_7',
    fields: [
      { uid: 1, base_uid: 30, key: 'phone', label: 'Phone', type: 'phone', var_name: 'AC_PHONE', required: true, is_phone: true, position: 0 },
      { uid: 2, base_uid: 30, key: 'name', label: 'Name', type: 'string', var_name: 'AC_NAME', required: false, is_phone: false, position: 1 },
    ] },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ autodialPage: {
    isBaseModalOpen: true, baseModalMode: 'edit', selectedBaseUid: 30,
  } }),
}));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialBaseQuery: () => ({ currentData: mocks.base, isFetching: false, isError: false }),
  useGetAutodialFieldUsageQuery: () => ({ currentData: { fields: [] } }),
  useCreateAutodialBaseMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateAutodialBaseMutation: () => [vi.fn(), { isLoading: false }],
  usePreviewAutodialSchemaMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock('./SchemaMigrationDialog', () => ({ SchemaMigrationDialog: () => null }));

describe('collapsed customer field editor', () => {
  it('keeps the edited schema on cancellation and closes only after explicit application confirmation', async () => {
    mocks.dispatch.mockClear();
    render(<BaseFormModal initialFieldUid={2} />);
    fireEvent.change(await screen.findByLabelText('autodial.bases.fieldLabel'), { target: { value: 'Edited customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    const confirmation = await screen.findByRole('dialog', { name: 'common.confirm' });
    expect(within(confirmation).getByText('autodial.workspace.discard')).toBeInTheDocument();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'common.cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'common.confirm' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('autodial.bases.fieldLabel')).toHaveValue('Edited customer');
    expect(mocks.dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'common.confirm' })).getByRole('button', { name: 'common.confirm' }));
    await waitFor(() => expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'autodialPage/closeBaseModal' })));
  });

  it('shows the schema without technical forms and preserves a draft when a field is collapsed', async () => {
    render(<BaseFormModal />);
    const name = await screen.findByRole('button', { name: /^Name/ });
    expect(name).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('autodial.bases.fieldLabel')).not.toBeInTheDocument();
    fireEvent.click(name);
    expect(screen.getByLabelText('autodial.bases.fieldLabel')).toHaveValue('Name');
    expect(screen.queryByLabelText('autodial.bases.fieldKey')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('autodial.bases.fieldLabel'), { target: { value: 'Customer' } });
    fireEvent.click(screen.getByRole('button', { name: /^Customer/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Customer/ }));
    expect(screen.getByLabelText('autodial.bases.fieldLabel')).toHaveValue('Customer');
    fireEvent.click(screen.getByRole('button', { name: 'autodial.workspace.fieldTechnical' }));
    expect(screen.getByLabelText('autodial.bases.fieldKey')).toHaveValue('name');
    expect(screen.getByLabelText('autodial.bases.varName')).toHaveValue('AC_NAME');
  });
  it('opens only the field selected from the separate Fields workspace', async () => {
    render(<BaseFormModal initialFieldUid={2} />);
    expect(await screen.findByLabelText('autodial.bases.fieldLabel')).toHaveValue('Name');
    expect(screen.getByRole('button', { name: /^Phone/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /^Name/ })).toHaveAttribute('aria-expanded', 'true');
  });
});
