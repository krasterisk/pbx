import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OperatorPicker, type OperatorOption } from './OperatorPicker';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

const OPERATORS: OperatorOption[] = [
  { userId: 11, name: 'Анна Петрова', exten: '201', interface: 'PJSIP/201' },
  { userId: 12, name: 'Борис Иванов', exten: '202', interface: 'PJSIP/202' },
  { userId: 13, name: 'Вера Сидорова', exten: '303', interface: 'PJSIP/303' },
];

describe('OperatorPicker (cc-ux U3.1)', () => {
  it('shows the placeholder and the selected operator on the trigger', () => {
    const { rerender } = render(<OperatorPicker operators={OPERATORS} value="" onChange={vi.fn()} />);
    expect(screen.getByTestId('cc-operator-picker')).toHaveTextContent('All operators');
    rerender(<OperatorPicker operators={OPERATORS} value="12" onChange={vi.fn()} />);
    expect(screen.getByTestId('cc-operator-picker')).toHaveTextContent('Борис Иванов (202)');
  });

  it('searches by name and by extension, and picks the user id', () => {
    const onChange = vi.fn();
    render(<OperatorPicker operators={OPERATORS} value="" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('cc-operator-picker'));

    fireEvent.change(screen.getByTestId('cc-operator-picker-search'), { target: { value: '303' } });
    expect(screen.queryByTestId('cc-operator-picker-option-11')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cc-operator-picker-option-13'));
    expect(onChange).toHaveBeenCalledWith('13');
  });

  it('says so when nobody matches and clears the choice with "all"', () => {
    const onChange = vi.fn();
    render(<OperatorPicker operators={OPERATORS} value="11" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('cc-operator-picker'));
    fireEvent.change(screen.getByTestId('cc-operator-picker-search'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('cc-operator-picker-empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cc-operator-picker-all'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
