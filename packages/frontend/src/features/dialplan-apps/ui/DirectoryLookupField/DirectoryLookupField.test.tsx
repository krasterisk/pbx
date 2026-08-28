import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DirectoryValueSource, IDirectory } from '@krasterisk/shared';
import { DirectoryLookupField } from './DirectoryLookupField';
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

const DIRECTORIES = [
  { uid: 7, name: 'Customers' },
  { uid: 8, name: 'VIP' },
];

const DIRECTORY_7: IDirectory = {
  uid: 7,
  user_uid: 1,
  name: 'Customers',
  lookup_field_uid: 17,
  key_normalization: 'digits',
  revision: 1,
  fields: [
    { uid: 17, directory_uid: 7, key: 'phone', label: 'Phone', type: 'phone', required: true, position: 0 },
    { uid: 18, directory_uid: 7, key: 'name', label: 'Name', type: 'string', required: false, position: 1 },
    { uid: 19, directory_uid: 7, key: 'vip', label: 'VIP', type: 'boolean', required: false, position: 2 },
  ],
};

const DIRECTORY_8: IDirectory = {
  uid: 8,
  user_uid: 1,
  name: 'VIP',
  lookup_field_uid: 21,
  key_normalization: 'digits',
  revision: 1,
  fields: [
    { uid: 21, directory_uid: 8, key: 'mobile', label: 'Mobile', type: 'phone', required: true, position: 0 },
    { uid: 22, directory_uid: 8, key: 'score', label: 'Score', type: 'number', required: false, position: 1 },
  ],
};

function mockDirectory(data: IDirectory | undefined) {
  (directoryApi.useGetDirectoryQuery as ReturnType<typeof vi.fn>).mockReturnValue({
    data,
    isLoading: false,
  });
}

const COMPLETE: DirectoryValueSource = {
  source: 'directory',
  directoryUid: 7,
  keySource: { source: 'original_caller' },
  valueFieldUid: 17,
  onMissing: 'skip',
};

describe('DirectoryLookupField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDirectory(DIRECTORY_7);
  });

  it('loads fields from the selected directory', () => {
    render(
      <DirectoryLookupField
        value={COMPLETE}
        onChange={vi.fn()}
        directories={DIRECTORIES}
      />,
    );

    expect(directoryApi.useGetDirectoryQuery).toHaveBeenCalledWith(7, expect.anything());
    const fieldSelect = screen.getByRole('combobox', { name: /поле|field/i });
    const values = Array.from(fieldSelect.querySelectorAll('option'))
      .map((opt) => opt.value)
      .filter(Boolean);
    expect(values).toEqual(expect.arrayContaining(['17', '18', '19']));
  });

  it('filters fields by expected type without hiding the current invalid selection', () => {
    render(
      <DirectoryLookupField
        value={{ ...COMPLETE, valueFieldUid: 18 }}
        onChange={vi.fn()}
        directories={DIRECTORIES}
        expectedType="phone"
      />,
    );

    const fieldSelect = screen.getByRole('combobox', { name: /поле|field/i });
    const values = Array.from(fieldSelect.querySelectorAll('option'))
      .map((opt) => opt.value)
      .filter(Boolean);
    expect(values).toContain('17');
    expect(values).toContain('18');
    expect(values).not.toContain('19');
  });

  it('clears an incompatible field when the directory changes', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DirectoryLookupField
        value={{ ...COMPLETE, valueFieldUid: 18 }}
        onChange={onChange}
        directories={DIRECTORIES}
      />,
    );

    mockDirectory(DIRECTORY_8);
    fireEvent.change(screen.getByRole('combobox', { name: /справочник|directory/i }), {
      target: { value: '8' },
    });

    rerender(
      <DirectoryLookupField
        value={{ ...COMPLETE, valueFieldUid: 18 }}
        onChange={onChange}
        directories={DIRECTORIES}
      />,
    );

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0] as DirectoryValueSource;
    expect(next.source).toBe('directory');
    expect(next.directoryUid).toBe(8);
    expect(next.valueFieldUid).not.toBe(18);
  });

  it('supports fixed, route pattern, variable, original caller, and current caller key sources', () => {
    render(
      <DirectoryLookupField
        value={COMPLETE}
        onChange={vi.fn()}
        directories={DIRECTORIES}
      />,
    );

    const keySelect = screen.getByRole('combobox', { name: /ключ|key/i });
    const values = Array.from(keySelect.querySelectorAll('option')).map((opt) => opt.value);
    expect(values).toEqual(
      expect.arrayContaining(['fixed', 'route_pattern', 'variable', 'original_caller', 'current_caller']),
    );
  });

  it('emits one complete DirectoryValueSource after selecting fixed and typing a key', () => {
    const onChange = vi.fn();
    render(
      <DirectoryLookupField
        value={COMPLETE}
        onChange={onChange}
        directories={DIRECTORIES}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /ключ|key/i }), {
      target: { value: 'fixed' },
    });
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByRole('combobox', { name: /ключ|key/i }) as HTMLSelectElement).value).toBe(
      'fixed',
    );

    fireEvent.change(screen.getByRole('textbox', { name: /значение ключа|fixed key|ключ/i }), {
      target: { value: '79001234567' },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      source: 'directory',
      directoryUid: 7,
      keySource: { source: 'fixed', value: '79001234567' },
      valueFieldUid: 17,
      onMissing: 'skip',
    });
  });

  it('emits only a complete DirectoryValueSource', () => {
    const onChange = vi.fn();
    render(
      <DirectoryLookupField
        value={COMPLETE}
        onChange={onChange}
        directories={DIRECTORIES}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: /поле|field/i }), {
      target: { value: '18' },
    });

    expect(onChange).toHaveBeenCalledWith({
      source: 'directory',
      directoryUid: 7,
      keySource: { source: 'original_caller' },
      valueFieldUid: 18,
      onMissing: 'skip',
    });
  });
});
