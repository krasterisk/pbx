import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OptionsEditor } from './OptionsEditor';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | Record<string, unknown>) =>
      typeof fallback === 'string' ? fallback : key,
  }),
}));

describe('OptionsEditor', () => {
  it('unchecks t and keeps U(sub-x) in place', () => {
    const onChange = vi.fn();
    render(
      <OptionsEditor
        value="tTU(sub-x)m"
        flags={['t', 'T', 'm']}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('checkbox', { name: /t -/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /T -/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /m -/ })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /t -/ }));
    expect(onChange).toHaveBeenCalledWith('TU(sub-x)m');
  });

  it('does not change checkboxes when the string has an unclosed parenthesis', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <OptionsEditor value="tT" flags={['t', 'T', 'm']} onChange={onChange} />,
    );
    expect(screen.getByRole('checkbox', { name: /t -/ })).toBeChecked();

    rerender(<OptionsEditor value="U(x" flags={['t', 'T', 'm']} onChange={onChange} />);
    expect(screen.getByRole('textbox', { name: /строк/i })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('checkbox', { name: /t -/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /T -/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /m -/ })).not.toBeChecked();
  });

  it('syncs checkboxes when the value is changed from outside', () => {
    const { rerender } = render(
      <OptionsEditor value="t" flags={['t', 'T']} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('checkbox', { name: /t -/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /T -/ })).not.toBeChecked();

    rerender(<OptionsEditor value="T" flags={['t', 'T']} onChange={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: /t -/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /T -/ })).toBeChecked();
  });
});
