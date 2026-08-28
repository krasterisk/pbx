import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { IDirectory } from '@krasterisk/shared';
import {
  DirectoryLookupOutputsField,
  validateDirectoryOutputTarget,
} from './DirectoryLookupOutputsField';
import * as directoryApi from '@/shared/api/endpoints/directoryApi';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

vi.mock('@/shared/api/endpoints/directoryApi', () => ({
  useGetDirectoryQuery: vi.fn(),
}));

const DIRECTORY: IDirectory = {
  uid: 7,
  user_uid: 1,
  name: 'Customers',
  lookup_field_uid: 17,
  key_normalization: 'digits',
  revision: 1,
  fields: [
    { uid: 17, directory_uid: 7, key: 'phone', label: 'Phone', type: 'phone', required: true, position: 0 },
    { uid: 18, directory_uid: 7, key: 'name', label: 'Name', type: 'string', required: false, position: 1 },
  ],
};

describe('DirectoryLookupOutputsField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: DIRECTORY,
      isLoading: false,
    });
  });

  it('rejects lowercase, punctuation, duplicates, CALLERID, and KRSK_* targets', () => {
    expect(validateDirectoryOutputTarget('customer_name', [])).toBeTruthy();
    expect(validateDirectoryOutputTarget('CUSTOMER-NAME', [])).toBeTruthy();
    expect(validateDirectoryOutputTarget('CALLERID', [])).toBeTruthy();
    expect(validateDirectoryOutputTarget('KRSK_SECRET', [])).toBeTruthy();
    expect(validateDirectoryOutputTarget('CUSTOMER_NAME', ['CUSTOMER_NAME'])).toBeTruthy();
    expect(validateDirectoryOutputTarget('CUSTOMER_NAME', [])).toBeNull();
  });

  it('shows a validation error for a reserved output name', () => {
    render(
      <DirectoryLookupOutputsField
        directoryUid={7}
        value={[{ fieldUid: 18, targetVariable: 'KRSK_NAME' }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/зарезерв|reserved|недопуст/i)).toBeInTheDocument();
  });

  it('adds an output mapping row', () => {
    const onChange = vi.fn();
    render(
      <DirectoryLookupOutputsField
        directoryUid={7}
        value={[{ fieldUid: 17, targetVariable: 'CUSTOMER_PHONE' }]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /добавить|add/i }));
    expect(onChange).toHaveBeenCalledWith([
      { fieldUid: 17, targetVariable: 'CUSTOMER_PHONE' },
      { fieldUid: 0, targetVariable: '' },
    ]);
  });
});
