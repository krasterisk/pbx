import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DurationInput } from './DurationInput';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key.split('.').at(-1) }) }));

describe('retry durations without fractional hours', () => {
  it('shows ten minutes as minutes while preserving sub-minute precision on edit', () => {
    const onChange = vi.fn(); render(<DurationInput id="retry" label="Retry" value={600} onChange={onChange} />);
    expect(screen.getByLabelText('Retry: hours')).toHaveValue(0);
    expect(screen.getByLabelText('Retry: minutes')).toHaveValue(10);
    fireEvent.change(screen.getByLabelText('Retry: seconds'), { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith(630);
  });
  it('distinguishes an inherited interval from an intentional zero', () => {
    const onChange = vi.fn(); const { rerender } = render(<DurationInput id="retry" label="Busy" value={undefined} fallback={600} onChange={onChange} />);
    expect(screen.getByLabelText('Busy: minutes')).toHaveValue(null);
    expect(screen.getByLabelText('Busy: minutes')).toHaveAttribute('placeholder', '10');
    fireEvent.change(screen.getByLabelText('Busy: minutes'), { target: { value: '0' } });
    expect(onChange).toHaveBeenLastCalledWith(0);
    rerender(<DurationInput id="retry" label="Busy" value={0} fallback={600} onChange={onChange} />);
    expect(screen.getByText('retryImmediately')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Busy: retryInherit' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
