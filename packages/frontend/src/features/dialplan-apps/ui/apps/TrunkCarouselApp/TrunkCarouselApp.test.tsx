import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrunkCarouselApp } from './TrunkCarouselApp';
import * as trunkApiHooks from '@/shared/api/endpoints/trunkApi';
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
    <span role="note" data-testid="trunk-carousel-hint">
      {text}
    </span>
  ),
}));

vi.mock('@/shared/api/endpoints/trunkApi', () => ({
  useGetTrunksQuery: vi.fn(),
}));

vi.mock('@/shared/api/endpoints/phonebookApi', () => ({
  useGetPhonebooksQuery: vi.fn(),
}));

const baseAction: IRouteAction = {
  id: 'action-tc',
  type: 'trunk_carousel',
  params: { mode: 'random_then_failover', trunks: [] },
  condition: {},
};

describe('TrunkCarouselApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (trunkApiHooks.useGetTrunksQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        { id: 1, name: 'trunk-a' },
        { id: 2, name: 'trunk-b' },
      ],
    });
    (phonebookApiHooks.useGetPhonebooksQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [{ uid: 4, name: 'CID Book', entries: [] }],
    });
  });

  it('shows app hint once via InfoTooltip on the trunks label row', () => {
    render(<TrunkCarouselApp action={baseAction} onUpdate={mockOnUpdate} />);

    const hint = screen.getByTestId('trunk-carousel-hint');
    expect(hint).toBeInTheDocument();
    const hintText =
      'Picks a random trunk first, then fails over down the ordered list on no-answer. Each trunk can set CallerID from a static number or a phonebook.';
    expect(hint).toHaveTextContent(hintText);
    expect(screen.getAllByText(hintText)).toHaveLength(1);
  });

  it('adds a trunk row and updates params.trunks via onUpdate', () => {
    render(<TrunkCarouselApp action={baseAction} onUpdate={mockOnUpdate} />);

    fireEvent.click(screen.getByLabelText('Add trunk'));

    expect(mockOnUpdate).toHaveBeenCalledWith('action-tc', 'params.trunks', [
      { trunk: '', cid_mode: 'static', callerid: '' },
    ]);
  });

  it('sets per-trunk CID mode and selects trunk', () => {
    render(
      <TrunkCarouselApp
        action={{
          ...baseAction,
          params: {
            mode: 'random_then_failover',
            trunks: [{ trunk: '', cid_mode: 'static', callerid: '' }],
          },
        }}
        onUpdate={mockOnUpdate}
      />,
    );

    const trunkSelect = screen.getByLabelText('Trunk') as HTMLSelectElement;
    fireEvent.change(trunkSelect, { target: { value: 'trunk-b' } });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-tc', 'params.trunks', [
      { trunk: 'trunk-b', cid_mode: 'static', callerid: '' },
    ]);

    const cidMode = screen.getByLabelText('CID source') as HTMLSelectElement;
    fireEvent.change(cidMode, { target: { value: 'phonebook' } });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-tc', 'params.trunks', [
      { trunk: '', cid_mode: 'phonebook', callerid: '' },
    ]);
  });

  it('reorders trunks via move up', () => {
    render(
      <TrunkCarouselApp
        action={{
          ...baseAction,
          params: {
            mode: 'random_then_failover',
            trunks: [
              { trunk: 'trunk-a', cid_mode: 'static', callerid: '100' },
              { trunk: 'trunk-b', cid_mode: 'static', callerid: '200' },
            ],
          },
        }}
        onUpdate={mockOnUpdate}
      />,
    );

    const upButtons = screen.getAllByLabelText('Up');
    fireEvent.click(upButtons[1]);

    expect(mockOnUpdate).toHaveBeenCalledWith('action-tc', 'params.trunks', [
      { trunk: 'trunk-b', cid_mode: 'static', callerid: '200' },
      { trunk: 'trunk-a', cid_mode: 'static', callerid: '100' },
    ]);
  });

  it('updates timeout and options', () => {
    render(<TrunkCarouselApp action={baseAction} onUpdate={mockOnUpdate} />);

    fireEvent.change(screen.getByLabelText('Timeout, sec'), { target: { value: '45' } });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-tc', 'params.timeout', '45');

    fireEvent.change(screen.getByLabelText('Options (tThH)'), { target: { value: 'tT' } });
    expect(mockOnUpdate).toHaveBeenCalledWith('action-tc', 'params.options', 'tT');
  });
});
