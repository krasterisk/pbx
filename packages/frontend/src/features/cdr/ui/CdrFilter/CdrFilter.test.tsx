import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CdrFilter } from './CdrFilter';
import { parseFiltersFromSearchParams } from '@/features/cdr/model/lib/cdrFiltersToParams';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

describe('CdrFilter voicemail checkbox (D-58)', () => {
  it('writes voicemail: 1 when the checkbox is checked', () => {
    const onChange = vi.fn();
    render(<CdrFilter filters={{}} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Голосовые сообщения' }));

    expect(onChange).toHaveBeenCalledWith({ voicemail: '1' });
  });

  it('writes voicemail: undefined when the checkbox is unchecked', () => {
    const onChange = vi.fn();
    render(<CdrFilter filters={{ voicemail: '1' }} onChange={onChange} />);

    expect(screen.getByRole('checkbox', { name: 'Голосовые сообщения' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Голосовые сообщения' }));

    expect(onChange).toHaveBeenCalledWith({ voicemail: undefined });
  });

  it('clearAll sets voicemail to undefined', () => {
    const onChange = vi.fn();
    render(<CdrFilter filters={{ voicemail: '1' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ voicemail: undefined }));
  });

  it('parses voicemail=1 from search params', () => {
    const parsed = parseFiltersFromSearchParams(new URLSearchParams('voicemail=1'));
    expect(parsed.voicemail).toBe('1');
  });
});
