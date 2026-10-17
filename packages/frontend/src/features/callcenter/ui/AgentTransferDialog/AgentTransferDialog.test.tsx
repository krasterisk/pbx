import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useGetTransferDirectoryQuery: () => ({
    data: {
      endpoints: [
        { id: 'e1', label: 'Anna Petrova', extension: '101', presence: 'READY' },
        { id: 'e2', label: 'Boris Ivanov', extension: '102', presence: 'BUSY' },
        { id: 'e3', label: 'Offline Olga', extension: '103', presence: 'OFFLINE' },
      ],
      queues: [],
      groups: [],
    },
  }),
}));

import { AgentTransferDialog } from './AgentTransferDialog';

function setup(over: Partial<React.ComponentProps<typeof AgentTransferDialog>> = {}) {
  const onTransfer = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <AgentTransferDialog
      open
      onOpenChange={onOpenChange}
      type="blind"
      onTypeChange={vi.fn()}
      onTransfer={onTransfer}
      {...over}
    />,
  );
  return { onTransfer, onOpenChange, ...utils };
}

describe('AgentTransferDialog (U2.5)', () => {
  beforeEach(() => localStorage.clear());

  it('focuses the search field on open and lists only reachable colleagues', () => {
    setup();
    expect(screen.getByTestId('cc-transfer-search')).toHaveFocus();
    expect(screen.getByTestId('cc-transfer-option-101')).toBeInTheDocument();
    expect(screen.getByTestId('cc-transfer-option-102')).toBeInTheDocument();
    expect(screen.queryByTestId('cc-transfer-option-103')).not.toBeInTheDocument();
  });

  it('Enter on a found target starts the transfer to it', () => {
    const { onTransfer } = setup();
    const input = screen.getByTestId('cc-transfer-search');
    fireEvent.change(input, { target: { value: 'anna' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onTransfer).toHaveBeenCalledTimes(1);
    expect(onTransfer).toHaveBeenCalledWith(expect.objectContaining({ value: '101' }));
  });

  it('Enter on a typed number with no match dials that number', () => {
    const { onTransfer } = setup();
    const input = screen.getByTestId('cc-transfer-search');
    fireEvent.change(input, { target: { value: '+380441234567' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onTransfer).toHaveBeenCalledWith({ value: '+380441234567', label: '+380441234567' });
  });

  it('offers an explicit button for a typed number outside the directory', () => {
    const { onTransfer } = setup();
    fireEvent.change(screen.getByTestId('cc-transfer-search'), { target: { value: '203' } });
    fireEvent.click(screen.getByRole('button', { name: 'Transfer to {{number}}' }));
    expect(onTransfer).toHaveBeenCalledWith({ value: '203', label: '203' });
  });

  it('does not transfer on Enter for an unknown name', () => {
    const { onTransfer } = setup();
    const input = screen.getByTestId('cc-transfer-search');
    fireEvent.change(input, { target: { value: 'nobody' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onTransfer).not.toHaveBeenCalled();
  });

  it('Esc closes the dialog', () => {
    const { onOpenChange } = setup();
    fireEvent.keyDown(screen.getByTestId('cc-transfer-search'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('requires explicit completion after consultation connects and allows return', () => {
    const complete = vi.fn(); const cancel = vi.fn();
    const { onTransfer } = setup({ consultation: { target: '202', phase: 'connected' }, onConsultComplete: complete, onConsultCancel: cancel });
    expect(onTransfer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('callcenter.transfer.consult.complete'));
    fireEvent.click(screen.getByText('callcenter.transfer.consult.cancel'));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('cc-transfer-search')).not.toBeInTheDocument();
  });

  it('shows recent targets when the search is empty', () => {
    localStorage.setItem('cc:transfer:recents', JSON.stringify([{ value: '101', label: 'Anna Petrova' }]));
    const { onTransfer } = setup();
    fireEvent.click(screen.getByTestId('cc-transfer-recent-101'));
    expect(onTransfer).toHaveBeenCalledWith({ value: '101', label: 'Anna Petrova' });
  });
});
