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

  it('defaults the period to today when the url has no dates', () => {
    const parsed = parseFiltersFromSearchParams(new URLSearchParams('direction=in'));
    const today = new Date();
    const expected = new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 10);

    expect(parsed.dateFrom).toBe(expected);
    expect(parsed.dateTo).toBe(expected);
  });

  it('keeps the whole history when the user cleared the period', () => {
    const parsed = parseFiltersFromSearchParams(new URLSearchParams('dateFrom=&dateTo='));

    expect(parsed.dateFrom).toBeUndefined();
    expect(parsed.dateTo).toBeUndefined();
  });

  it('clearing the period asks the page to remember an empty period', () => {
    const onChange = vi.fn();
    render(<CdrFilter filters={{ dateFrom: '2026-10-17', dateTo: '2026-10-17' }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Очистить' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: '', dateTo: '' }));
  });
});
