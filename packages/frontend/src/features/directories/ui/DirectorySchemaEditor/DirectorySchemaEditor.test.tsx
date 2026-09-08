import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DirectoryFieldType } from '@krasterisk/shared';
import { DirectorySchemaEditor, type IDirectoryFieldDraft } from './DirectorySchemaEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));

function field(
  overrides: Partial<IDirectoryFieldDraft> & Pick<IDirectoryFieldDraft, 'key'>,
): IDirectoryFieldDraft {
  return {
    label: overrides.label ?? overrides.key,
    type: (overrides.type ?? 'string') as DirectoryFieldType,
    required: overrides.required ?? false,
    position: overrides.position ?? 0,
    ...overrides,
  };
}

function SchemaHarness({
  initialFields,
  initialLookup,
}: {
  initialFields: IDirectoryFieldDraft[];
  initialLookup: string;
}) {
  const [fields, setFields] = useState(initialFields);
  const [lookupFieldKey, setLookupFieldKey] = useState(initialLookup);
  return (
    <DirectorySchemaEditor
      fields={fields}
      lookupFieldKey={lookupFieldKey}
      onFieldsChange={setFields}
      onLookupFieldKeyChange={setLookupFieldKey}
    />
  );
}

describe('DirectorySchemaEditor', () => {
  it('picks the lookup field through one selector instead of per-field switches', () => {
    render(
      <SchemaHarness
        initialFields={[
          field({ key: 'phone', type: 'phone', position: 0 }),
          field({ key: 'name', type: 'string', position: 1 }),
        ]}
        initialLookup="phone"
      />,
    );

    expect(screen.queryByTestId('field-lookup-phone')).not.toBeInTheDocument();

    const selector = screen.getByTestId('directory-lookup-field') as HTMLSelectElement;
    expect(selector).toHaveValue('phone');
    expect([...selector.options].map((option) => option.value)).toEqual(['', 'phone', 'name']);

    fireEvent.change(selector, { target: { value: 'name' } });

    expect(screen.getByTestId('directory-lookup-field')).toHaveValue('name');
  });

  it('disables the lookup selector until a field key exists', () => {
    render(<SchemaHarness initialFields={[]} initialLookup="" />);

    expect(screen.getByTestId('directory-lookup-field')).toBeDisabled();

    fireEvent.click(screen.getByTestId('directory-add-field'));

    expect(screen.getByTestId('directory-lookup-field')).not.toBeDisabled();
  });

  it('keeps focus on the key input while typing', () => {
    render(<SchemaHarness initialFields={[]} initialLookup="" />);

    fireEvent.click(screen.getByTestId('directory-add-field'));
    const input = screen.getByTestId('field-key-0');
    input.focus();
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: 'aaa' } });

    expect(screen.getByTestId('field-key-0')).toHaveFocus();
    expect(screen.getByTestId('field-key-0')).toHaveValue('aaa');
  });
});
