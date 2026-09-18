import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImportWizard } from './ImportWizard';

const mocks = vi.hoisted(() => ({ preview: vi.fn(), run: vi.fn(), save: vi.fn(), dispatch: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/shared/hooks/useAppStore', () => ({
  useAppDispatch: () => mocks.dispatch,
  useAppSelector: () => true,
}));
vi.mock('@/shared/api/endpoints/autodialApi', () => ({
  useGetAutodialBaseQuery: () => ({ currentData: { name: 'Base', fields: [], contact_count: 3, dedup_policy: 'phone' } }),
  useGetAutodialImportProfilesQuery: () => ({ currentData: [{
    uid: 8, name: 'Saved', delimiter: ',', has_header: false, dedup_policy: 'external_id',
    column_map: [{ column: 'phone', column_index: 0, field_key: '__phone' }],
  }] }),
  usePreviewAutodialImportMutation: () => [mocks.preview, { isLoading: false }],
  useImportAutodialFileMutation: () => [mocks.run, { isLoading: false }],
  useUpsertAutodialImportProfileMutation: () => [mocks.save, { isLoading: false }],
}));
const preview = { headers: ['phone'], sample_rows: [['79001234567']], total_rows: 1, delimiter: ';', base_revision: 7 };
const upload = async () => {
  fireEvent.change(screen.getByLabelText('autodial.import.file'), {
    target: { files: [new File(['phone;name\n79001234567;Alice'], 'contacts.csv')] },
  });
  await screen.findByRole('button', { name: 'autodial.import.run' });
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.preview.mockImplementation(() => ({ unwrap: () => Promise.resolve(preview) }));
  mocks.run.mockImplementation(() => ({ unwrap: () => Promise.resolve({ imported: 1, skipped: 0, errors: [] }) }));
  mocks.save.mockImplementation(() => ({ unwrap: () => Promise.resolve({ uid: 8 }) }));
});

describe('ImportWizard contracts', () => {
  it('sends parsing settings to preview and revision/index mapping to commit', async () => {
    render(<ImportWizard baseUid={1} />);
    fireEvent.change(screen.getByLabelText('autodial.import.delimiter'), { target: { value: ',' } });
    fireEvent.click(screen.getByLabelText('autodial.import.hasHeader'));
    await upload();
    expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({ baseUid: 1, delimiter: ',', has_header: false }));
    fireEvent.click(screen.getByRole('button', { name: 'autodial.import.run' }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({
      expected_revision: 7, has_header: false,
      column_map: [{ column: 'phone', column_index: 0, field_key: '__phone', transform: 'phone_normalize' }],
    })));
  });
  it('applies a saved profile to preview and carries its dedup policy into import', async () => {
    render(<ImportWizard baseUid={1} />);
    await upload();
    fireEvent.change(screen.getByLabelText('autodial.import.profile'), { target: { value: '8' } });
    await waitFor(() => expect(mocks.preview).toHaveBeenLastCalledWith(expect.objectContaining({ delimiter: ',', has_header: false })));
    fireEvent.click(screen.getByRole('button', { name: 'autodial.import.run' }));
    await waitFor(() => expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ profile_uid: 8, dedup_policy: 'external_id', has_header: false })));
  });
  it('keeps profile name and mapping when saving the profile fails', async () => {
    mocks.save.mockImplementation(() => ({ unwrap: () => Promise.reject(new Error('offline')) }));
    render(<ImportWizard baseUid={1} />);
    await upload();
    fireEvent.change(screen.getByLabelText('autodial.import.saveProfileAs'), { target: { value: 'My profile' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(await screen.findByText('autodial.import.saveProfileFailed')).toBeInTheDocument();
    expect(screen.getByDisplayValue('My profile')).toBeInTheDocument();
  });
  it('returns to upload after a failed profile preview', async () => {
    render(<ImportWizard baseUid={1} />);
    await upload();
    mocks.preview.mockImplementation(() => ({ unwrap: () => Promise.reject(new Error('offline')) }));
    fireEvent.change(screen.getByLabelText('autodial.import.profile'), { target: { value: '8' } });
    expect(await screen.findByText('autodial.import.previewFailed')).toBeInTheDocument();
    expect(screen.getByLabelText('autodial.import.file')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'autodial.import.run' })).not.toBeInTheDocument();
  });
  it('rejects unsupported xls before reading or sending the file', async () => {
    render(<ImportWizard baseUid={1} />);
    fireEvent.change(screen.getByLabelText('autodial.import.file'), { target: { files: [new File(['data'], 'old.xls')] } });
    expect(await screen.findByText('autodial.import.invalidFile')).toBeInTheDocument();
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});
