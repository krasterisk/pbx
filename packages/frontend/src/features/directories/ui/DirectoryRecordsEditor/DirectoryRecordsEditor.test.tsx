import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { DirectoryFieldType } from '@krasterisk/shared';
import { DirectoryRecordsEditor, type IDirectoryRecordDraft } from './DirectoryRecordsEditor';
import type { IDirectoryFieldDraft } from '../DirectorySchemaEditor/DirectorySchemaEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru' },
  }),
}));

function field(key: string, type: DirectoryFieldType, position: number): IDirectoryFieldDraft {
  return { key, label: key, type, required: false, position };
}

function RecordsHarness({
  fields,
  lookupFieldKey,
}: {
  fields: IDirectoryFieldDraft[];
  lookupFieldKey: string;
}) {
  const [records, setRecords] = useState<IDirectoryRecordDraft[]>([
    { match_kind: 'exact', priority: 1, values: { [lookupFieldKey]: '100' } },
  ]);
  return (
    <DirectoryRecordsEditor
      fields={fields}
      lookupFieldKey={lookupFieldKey}
      records={records}
      onRecordsChange={setRecords}
    />
  );
}

describe('DirectoryRecordsEditor', () => {
  it('disables the pattern option unless the lookup field type is phone', () => {
    const { rerender } = render(
      <RecordsHarness
        fields={[field('code', 'string', 0)]}
        lookupFieldKey="code"
      />,
    );

    expect(screen.getByTestId('record-pattern-0')).toBeDisabled();

    rerender(
      <RecordsHarness
        fields={[field('phone', 'phone', 0)]}
        lookupFieldKey="phone"
      />,
    );

    expect(screen.getByTestId('record-pattern-0')).not.toBeDisabled();
  });

  it('marks the records region for horizontal scrolling at 360 px', () => {
    render(
      <RecordsHarness
        fields={[field('phone', 'phone', 0), field('name', 'string', 1)]}
        lookupFieldKey="phone"
      />,
    );

    const region = screen.getByTestId('directory-records-scroll');
    expect(region).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(region).toHaveAttribute('data-viewport', '360');
  });
});
