import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CallerIdApp, resolveCallerIdMode } from './CallerIdApp';
import * as phonebookApiHooks from '@/shared/api/endpoints/phonebookApi';
import type { IRouteAction } from '@krasterisk/shared';

const mockOnUpdate = vi.fn();

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

const baseAction: IRouteAction = {
  id: 'action-cid',
  type: 'callerid',
  params: { mode: 'static', callerid: '' },
  condition: {},
};

describe('resolveCallerIdMode', () => {
  it('infers setclid_list from legacy action type', () => {
    expect(resolveCallerIdMode('setclid_list', { list_uid: 5 })).toBe('setclid_list');
  });

  it('infers static from setclid_custom', () => {
    expect(resolveCallerIdMode('setclid_custom', { callerid: '100' })).toBe('static');
  });

  it('prefers explicit params.mode', () => {
    expect(resolveCallerIdMode('setclid_list', { mode: 'carousel', pool: ['1'] })).toBe(
      'carousel',
    );
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

  it('calls onUpdate when mode changes and shows mode-specific fields', () => {
    render(<CallerIdApp action={baseAction} onUpdate={mockOnUpdate} />);

    expect(screen.getByLabelText('CallerID number')).toBeInTheDocument();
    expect(screen.getByLabelText('CallerID name (optional)')).toBeInTheDocument();

    const modeSelect = screen.getByLabelText('CallerID mode') as HTMLSelectElement;
    fireEvent.change(modeSelect, { target: { value: 'phonebook' } });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-cid', 'params.mode', 'phonebook');
  });

  it('renders phonebook select when mode is phonebook', () => {
    render(
      <CallerIdApp
        action={{ ...baseAction, params: { mode: 'phonebook', phonebook_uid: '' } }}
        onUpdate={mockOnUpdate}
      />,
    );

    const pbSelect = screen.getByLabelText('Select phonebook') as HTMLSelectElement;
    expect(Array.from(pbSelect.options).map((o) => o.value)).toEqual(['', '2', '9']);

    fireEvent.change(pbSelect, { target: { value: '9' } });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-cid', 'params.phonebook_uid', '9');
  });

  it('renders list_uid field for setclid_list mode', () => {
    render(
      <CallerIdApp
        action={{
          ...baseAction,
          type: 'setclid_list',
          params: { list_uid: '5' },
        }}
        onUpdate={mockOnUpdate}
      />,
    );

    const listInput = screen.getByLabelText('List ID') as HTMLInputElement;
    expect(listInput.value).toBe('5');
    fireEvent.change(listInput, { target: { value: '12' } });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-cid', 'params.list_uid', '12');
  });

  it('supports carousel pool add and reorder via onUpdate(params.pool)', () => {
    render(
      <CallerIdApp
        action={{
          ...baseAction,
          params: { mode: 'carousel', pool: ['111', '222'] },
        }}
        onUpdate={mockOnUpdate}
      />,
    );

    expect(screen.getByDisplayValue('111')).toBeInTheDocument();
    expect(screen.getByDisplayValue('222')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Add number to pool'), {
      target: { value: '333' },
    });
    fireEvent.click(screen.getByLabelText('Add'));
    expect(mockOnUpdate).toHaveBeenCalledWith('action-cid', 'params.pool', [
      '111',
      '222',
      '333',
    ]);

    const upButtons = screen.getAllByLabelText('Up');
    fireEvent.click(upButtons[1]);
    expect(mockOnUpdate).toHaveBeenCalledWith('action-cid', 'params.pool', ['222', '111']);
  });
});
