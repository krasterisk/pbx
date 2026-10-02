import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { type Table } from '@tanstack/react-table';
import { TableSelectionBanner } from './TableSelectionBanner';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts.pageCount === 'number') return `${key}:${opts.pageCount}`;
      if (opts && typeof opts.total === 'number') return `${key}:${opts.total}`;
      return key;
    },
  }),
}));

function stubTable(options: {
  pageIds: string[];
  selected: string[];
  filteredCount: number;
  pageSize: number;
}): Table<unknown> {
  const selected = new Set(options.selected);
  return {
    getRowModel: () => ({
      rows: options.pageIds.map((id) => ({ getIsSelected: () => selected.has(id) })),
    }),
    getFilteredRowModel: () => ({ rows: Array.from({ length: options.filteredCount }) }),
    getState: () => ({ pagination: { pageSize: options.pageSize } }),
  } as unknown as Table<unknown>;
}

describe('TableSelectionBanner', () => {
  it('stays hidden for a single row so the table does not shift', () => {
    render(
      <TableSelectionBanner
        table={stubTable({
          pageIds: ['a', 'b', 'c'],
          selected: ['a'],
          filteredCount: 80,
          pageSize: 50,
        })}
        allMatchingSelected={false}
        selectedIds={['a']}
        selectedCount={1}
        onSelectAllMatching={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('table-selection-banner')).not.toBeInTheDocument();
  });

  it('stays hidden when the whole list fits on one page', () => {
    render(
      <TableSelectionBanner
        table={stubTable({
          pageIds: ['a', 'b'],
          selected: ['a', 'b'],
          filteredCount: 2,
          pageSize: 50,
        })}
        allMatchingSelected={false}
        selectedIds={['a', 'b']}
        selectedCount={2}
        onSelectAllMatching={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('table-selection-banner')).not.toBeInTheDocument();
  });

  it('offers select-all only after the current page is fully selected', async () => {
    const onSelectAllMatching = vi.fn();
    const user = userEvent.setup();
    render(
      <TableSelectionBanner
        table={stubTable({
          pageIds: ['a', 'b'],
          selected: ['a', 'b'],
          filteredCount: 5,
          pageSize: 2,
        })}
        allMatchingSelected={false}
        selectedIds={['a', 'b']}
        selectedCount={2}
        onSelectAllMatching={onSelectAllMatching}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText('common.selectionBannerPage:2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'common.selectionBannerSelectAll:5' }));
    expect(onSelectAllMatching).toHaveBeenCalledOnce();
  });

  it('offers clear when every filtered row is already selected', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <TableSelectionBanner
        table={stubTable({
          pageIds: ['a', 'b'],
          selected: ['a', 'b'],
          filteredCount: 5,
          pageSize: 2,
        })}
        allMatchingSelected
        selectedIds={['a', 'b', 'c', 'd', 'e']}
        selectedCount={5}
        onSelectAllMatching={vi.fn()}
        onClear={onClear}
      />,
    );

    expect(screen.getByText('common.selectionBannerAll:5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'common.selectionBannerClear' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
