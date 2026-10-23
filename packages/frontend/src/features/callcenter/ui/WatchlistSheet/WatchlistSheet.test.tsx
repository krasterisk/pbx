import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WatchlistSheet } from './WatchlistSheet';

const candidates = [
  { userId: 1, name: 'Иванов', exten: '101', online: true },
  { userId: 2, name: 'Петров', exten: '102' },
  { userId: 3, name: 'Сидоров', exten: '103' },
];
const agents = [
  { userId: 1, queues: ['q700_0'] },
  { userId: 2, queues: ['q700_0'] },
];

function Harness({ onSave, flat = false, onClose = () => undefined }: { onSave: () => void; flat?: boolean; onClose?: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  return (
    <WatchlistSheet
      flat={flat}
      open
      onOpenChange={onClose}
      candidates={candidates}
      agents={agents}
      queueLabel={(q) => `Q ${q}`}
      selectedUserIds={selected}
      onSelectedChange={setSelected}
      onSave={onSave}
    />
  );
}

describe('WatchlistSheet (U1.7)', () => {
  it('keeps flat team edits as a draft until Save and lets Cancel close without saving', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<Harness flat onSave={onSave} onClose={onClose} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Cancel|Отмена/ }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('cc-watchlist-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
  it('groups by queue, selects a whole queue in one click and filters by search', () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    expect(screen.getByTestId('cc-watchlist-group-queue:q700_0')).toBeInTheDocument();
    expect(screen.getByTestId('cc-watchlist-group-queue:__none__')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cc-watchlist-toggle-queue:q700_0'));
    expect(screen.getByTestId('cc-watchlist-group-queue:q700_0')).toHaveTextContent('2/2');
    expect(screen.getByTestId('cc-watchlist-group-queue:__none__')).toHaveTextContent('0/1');

    fireEvent.change(screen.getByTestId('cc-watchlist-search'), { target: { value: 'Сидоров' } });
    expect(screen.queryByTestId('cc-watchlist-group-queue:q700_0')).not.toBeInTheDocument();
    expect(screen.getByTestId('cc-watchlist-group-queue:__none__')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cc-watchlist-save'));
    expect(onSave).toHaveBeenCalled();
  });
});
