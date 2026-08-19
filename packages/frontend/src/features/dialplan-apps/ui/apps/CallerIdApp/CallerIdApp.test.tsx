import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CallerIdApp, resolveCallerIdMode } from './CallerIdApp';
import * as phonebookApiHooks from '@/shared/api/endpoints/phonebookApi';

const mockOnChange = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('@/shared/ui/Tooltip/Tooltip', () => ({
  InfoTooltip: ({ text }: { text: string }) => (
    <span role="note" data-testid="mode-hint">
      {text}
    </span>
  ),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: vi.fn(),
}));

const baseParams = { mode: 'static', callerid: '' };

describe('resolveCallerIdMode', () => {
  it('infers setclid_list from legacy action type', () => {
    expect(resolveCallerIdMode('setclid_list', { list_uid: 5 })).toBe('setclid_list');
  });

  it('infers static from setclid_custom', () => {
    expect(resolveCallerIdMode('setclid_custom', { callerid: '100' })).toBe('static');
  });

  it('prefers explicit params.mode', () => {
    expect(resolveCallerIdMode('setclid_list', { mode: 'carousel', pool: ['1'] })).toBe('carousel');
  });
});

describe('CallerIdApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (phonebookApiHooks.useGetPhonebooksQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { uid: 2, name: 'Sales PB', entries: [] },
        { uid: 9, name: 'Support PB', entries: [] },
      ],
    });
  });

  it('shows mode hint once via InfoTooltip on the mode label row', () => {
    render(<CallerIdApp params={baseParams} onChange={mockOnChange} />);

    const hint = screen.getByTestId('mode-hint');
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent('Sets CALLERID(num) and optional CALLERID(name) to fixed values.');
    expect(
      screen.getAllByText('Sets CALLERID(num) and optional CALLERID(name) to fixed values.'),
    ).toHaveLength(1);
  });

  it('calls onChange when mode changes and shows mode-specific fields', () => {
    render(<CallerIdApp params={baseParams} onChange={mockOnChange} />);

    expect(screen.getByLabelText('CallerID number')).toBeInTheDocument();
    expect(screen.getByLabelText('CallerID name (optional)')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('CallerID mode'), { target: { value: 'phonebook' } });
    expect(mockOnChange).toHaveBeenCalledWith({ mode: 'phonebook' });
  });

  it('renders phonebook select when mode is phonebook', () => {
    render(
      <CallerIdApp
        params={{ mode: 'phonebook', phonebook_uid: '' }}
        onChange={mockOnChange}
      />,
    );

    const pbSelect = screen.getByLabelText('Select phonebook') as HTMLSelectElement;
    expect(Array.from(pbSelect.options).map((o) => o.value)).toEqual(['', '2', '9']);

    fireEvent.change(pbSelect, { target: { value: '9' } });
    expect(mockOnChange).toHaveBeenCalledWith({ phonebook_uid: '9' });
  });

  it('renders list_uid field for setclid_list mode', () => {
    render(
      <CallerIdApp
        actionType="setclid_list"
        params={{ list_uid: '5' }}
        onChange={mockOnChange}
      />,
    );

    const listInput = screen.getByLabelText('List ID') as HTMLInputElement;
    expect(listInput.value).toBe('5');
    fireEvent.change(listInput, { target: { value: '12' } });
    expect(mockOnChange).toHaveBeenCalledWith({ list_uid: '12' });
  });

  it('supports carousel pool add and reorder via onChange({ pool })', () => {
    render(
      <CallerIdApp
        params={{ mode: 'carousel', pool: ['111', '222'] }}
        onChange={mockOnChange}
      />,
    );

    expect(screen.getByDisplayValue('111')).toBeInTheDocument();
    expect(screen.getByDisplayValue('222')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Add number to pool'), {
      target: { value: '333' },
    });
    fireEvent.click(screen.getByLabelText('Add'));
    expect(mockOnChange).toHaveBeenCalledWith({ pool: ['111', '222', '333'] });

    fireEvent.click(screen.getAllByLabelText('Up')[1]);
    expect(mockOnChange).toHaveBeenCalledWith({ pool: ['222', '111'] });
  });
});
