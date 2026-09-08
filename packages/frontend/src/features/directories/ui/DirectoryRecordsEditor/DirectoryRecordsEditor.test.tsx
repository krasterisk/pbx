import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  initialRecords,
  keyNormalization = 'digits',
}: {
  fields: IDirectoryFieldDraft[];
  lookupFieldKey: string;
  initialRecords?: IDirectoryRecordDraft[];
  keyNormalization?: 'none' | 'digits';
}) {
  const [records, setRecords] = useState<IDirectoryRecordDraft[]>(
    initialRecords ?? [{ values: { [lookupFieldKey]: '100' } }],
  );
  return (
    <DirectoryRecordsEditor
      fields={fields}
      lookupFieldKey={lookupFieldKey}
      keyNormalization={keyNormalization}
      records={records}
      onRecordsChange={setRecords}
    />
  );
}

describe('DirectoryRecordsEditor', () => {
  it('explains Asterisk patterns on a phone lookup field and flags a duplicate pattern', () => {
    render(
      <RecordsHarness
        fields={[field('phone', 'phone', 0), field('name', 'string', 1)]}
        lookupFieldKey="phone"
        initialRecords={[
          { values: { phone: '_7900XXXXXXX', name: 'A' } },
          { values: { phone: '_7900123XXXX', name: 'B' } },
          { values: { phone: '_7900XXXXXXX', name: 'C' } },
        ]}
      />,
    );

    expect(screen.getByTestId('record-duplicate-0')).toBeInTheDocument();
    expect(screen.getByTestId('record-duplicate-2')).toBeInTheDocument();
    expect(screen.queryByTestId('record-duplicate-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('record-match-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('record-priority-0')).not.toBeInTheDocument();
  });

  it('marks the records region for desktop scrolling and mobile cards', () => {
    render(
      <RecordsHarness
        fields={[field('phone', 'phone', 0), field('name', 'string', 1)]}
        lookupFieldKey="phone"
      />,
    );

    const region = screen.getByTestId('directory-records-scroll');
    expect(region).toHaveAttribute('data-hybrid', 'overflow-x-auto');
    expect(region).toHaveAttribute('data-viewport', '360,768,1440');
    expect(region).toHaveAttribute('data-mobile-layout', 'card');
  });

  it('paginates large record sets instead of mounting every row', () => {
    const records: IDirectoryRecordDraft[] = Array.from({ length: 60 }, (_, i) => ({
      values: { phone: String(1000 + i) },
    }));

    render(
      <RecordsHarness
        fields={[field('phone', 'phone', 0)]}
        lookupFieldKey="phone"
        initialRecords={records}
      />,
    );

    expect(screen.getByTestId('directory-records-total')).toHaveTextContent('60');
    expect(screen.getAllByTestId(/^record-row-/)).toHaveLength(25);
    expect(screen.getByTestId('record-row-0')).toBeInTheDocument();
    expect(screen.queryByTestId('record-row-25')).not.toBeInTheDocument();
    expect(screen.getByTestId('directory-records-prev')).toBeDisabled();

    fireEvent.click(screen.getByTestId('directory-records-next'));

    expect(screen.getByTestId('record-row-25')).toBeInTheDocument();
    expect(screen.queryByTestId('record-row-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('directory-records-prev')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('directory-records-next'));

    expect(screen.getByTestId('record-row-50')).toBeInTheDocument();
    expect(screen.getByTestId('directory-records-next')).toBeDisabled();
  });

  it('hides the pager when a single page holds every record', () => {
    render(
      <RecordsHarness fields={[field('phone', 'phone', 0)]} lookupFieldKey="phone" />,
    );

    expect(screen.queryByTestId('directory-records-pager')).not.toBeInTheDocument();
  });

  it('jumps to the page holding a freshly added record', () => {
    const records: IDirectoryRecordDraft[] = Array.from({ length: 25 }, (_, i) => ({
      values: { phone: String(1000 + i) },
    }));

    render(
      <RecordsHarness
        fields={[field('phone', 'phone', 0)]}
        lookupFieldKey="phone"
        initialRecords={records}
      />,
    );

    fireEvent.click(screen.getByTestId('directory-add-record'));

    expect(screen.getByTestId('record-row-25')).toBeInTheDocument();
  });
});
