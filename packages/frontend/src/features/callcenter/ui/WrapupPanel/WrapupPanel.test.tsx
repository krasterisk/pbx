import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const doneMock = vi.fn(() => ({ unwrap: async () => ({ success: true }) }));
const extendMock = vi.fn(() => ({ unwrap: async () => ({ success: true }) }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown, opts?: Record<string, unknown>) => {
      const text = typeof fallback === 'string' ? fallback : key;
      const vars = (typeof fallback === 'object' ? fallback : opts) as Record<string, unknown> | undefined;
      return vars ? text.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars[k] ?? '')) : text;
    },
  }),
}));

vi.mock('@/shared/api/endpoints/callCenterApi', () => ({
  useAgentWrapupDoneMutation: () => [doneMock, { isLoading: false }],
  useAgentWrapupExtendMutation: () => [extendMock, { isLoading: false }],
}));

import { WrapupPanel } from './WrapupPanel';

const renderPanel = (over: Partial<React.ComponentProps<typeof WrapupPanel>> = {}) =>
  render(
    <WrapupPanel
      remainingSec={25}
      totalSec={30}
      extendStep={30}
      note=""
      onNoteChange={vi.fn()}
      {...over}
    />,
  );

describe('WrapupPanel (U2.3)', () => {
  beforeEach(() => {
    doneMock.mockClear();
    extendMock.mockClear();
  });

  it('"Done" finishes the wrap-up once even when clicked twice, and saves the note first', async () => {
    const onSaveNote = vi.fn(async () => undefined);
    renderPanel({ note: '  called back  ', onSaveNote });
    const done = screen.getByTestId('wrapup-done');
    fireEvent.click(done);
    fireEvent.click(done);
    await waitFor(() => expect(doneMock).toHaveBeenCalledTimes(1));
    expect(onSaveNote).toHaveBeenCalledWith('called back');
  });

  it('does not save an empty note', async () => {
    const onSaveNote = vi.fn();
    renderPanel({ note: '   ', onSaveNote });
    fireEvent.click(screen.getByTestId('wrapup-done'));
    await waitFor(() => expect(doneMock).toHaveBeenCalledTimes(1));
    expect(onSaveNote).not.toHaveBeenCalled();
  });

  it('extends by the configured step', async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('wrapup-extend'));
    await waitFor(() => expect(extendMock).toHaveBeenCalledWith({ seconds: 30 }));
  });

  it('announces politely once, when 10 seconds remain', () => {
    const { rerender } = renderPanel({ remainingSec: 11 });
    expect(screen.getByTestId('wrapup-announcement')).toHaveTextContent('');
    rerender(
      <WrapupPanel remainingSec={10} totalSec={30} extendStep={30} note="" onNoteChange={vi.fn()} />,
    );
    const region = screen.getByTestId('wrapup-announcement');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Wrap-up ends in 10 seconds');
  });

  it('blocks Done while an outcome is required and renders the outcome slot', () => {
    renderPanel({ outcomeRequired: true, outcomeSlot: <div data-testid="outcome-slot" /> });
    expect(screen.getByTestId('outcome-slot')).toBeInTheDocument();
    expect(screen.getByTestId('wrapup-done')).toBeDisabled();
  });
  it('keeps processing open after a failed note save and allows the same action to retry', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    renderPanel({ note: 'Keep this answer', onSaveNote: save });
    fireEvent.click(screen.getByTestId('wrapup-done'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not finish wrap-up'));
    expect(doneMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('wrapup-done'));
    await waitFor(() => expect(doneMock).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledTimes(2);
  });
});
