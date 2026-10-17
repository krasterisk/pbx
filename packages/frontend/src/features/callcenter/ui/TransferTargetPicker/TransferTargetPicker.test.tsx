import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TransferTargetPicker } from './TransferTargetPicker';

describe('TransferTargetPicker (U1.4)', () => {
  const options = [
    { value: 'PJSIP/101', label: 'Иванов (101)', group: 'agent' as const },
    { value: 'PJSIP/102', label: 'Петрова (102)', group: 'agent' as const },
    { value: 'q700_0', label: 'Продажи (700)', group: 'queue' as const },
  ];

  it('opens popover, filters targets by query and selects a target once', () => {
    const onSelect = vi.fn();
    render(
      <TransferTargetPicker
        options={options}
        triggerLabel="Направить"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByTestId('cc-transfer-picker'));
    const search = screen.getByTestId('cc-transfer-picker-search');
    fireEvent.change(search, { target: { value: 'Петр' } });

    expect(screen.queryByTestId('cc-transfer-picker-option-PJSIP/101')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cc-transfer-picker-option-PJSIP/102'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('PJSIP/102');
  });
});
