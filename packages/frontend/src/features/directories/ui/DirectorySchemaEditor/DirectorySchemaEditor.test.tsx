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
  it('marking a field as lookup unmarks the previous field', () => {
    render(
      <SchemaHarness
        initialFields={[
          field({ key: 'phone', type: 'phone', position: 0 }),
          field({ key: 'name', type: 'string', position: 1 }),
        ]}
        initialLookup="phone"
      />,
    );

    const phoneSwitch = screen.getByTestId('field-lookup-phone');
    const nameSwitch = screen.getByTestId('field-lookup-name');
    expect(phoneSwitch).toHaveAttribute('data-state', 'checked');
    expect(nameSwitch).toHaveAttribute('data-state', 'unchecked');

    fireEvent.click(nameSwitch);

    expect(nameSwitch).toHaveAttribute('data-state', 'checked');
    expect(phoneSwitch).toHaveAttribute('data-state', 'unchecked');
  });
});
