import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgentStartScreen } from './AgentStartScreen';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k, i18n: { language: 'en' } }),
}));

vi.mock('../ShiftLoginModal/ShiftLoginForm', () => ({
  ShiftLoginForm: ({ active, onConfirm }: { active: boolean; onConfirm: (r: unknown) => void }) => (
    <button
      type="button"
      data-testid="start-shift"
      data-active={String(active)}
      onClick={() => onConfirm({ mode: 'sip', interface: 'PJSIP/101', queues: ['sales'] })}
    >
      start
    </button>
  ),
}));

describe('AgentStartScreen', () => {
  it('shows one active shift form and forwards the confirmed result', () => {
    const onConfirm = vi.fn();
    render(<AgentStartScreen onConfirm={onConfirm} />);

    expect(screen.getByTestId('agent-start-screen')).toBeInTheDocument();
    expect(screen.getAllByTestId('start-shift')).toHaveLength(1);
    expect(screen.getByTestId('start-shift')).toHaveAttribute('data-active', 'true');

    fireEvent.click(screen.getByTestId('start-shift'));
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'sip', interface: 'PJSIP/101', queues: ['sales'] });
  });

  it('does not render workspace panels', () => {
    render(<AgentStartScreen onConfirm={vi.fn()} />);
    expect(screen.queryByTestId('cc-panel-coworkers')).toBeNull();
    expect(screen.queryByTestId('cc-panel-queues')).toBeNull();
  });

  it('shows the previous shift and stays quiet when there is none', () => {
    const { rerender } = render(<AgentStartScreen onConfirm={vi.fn()} />);
    expect(screen.queryByTestId('agent-last-shift')).not.toBeInTheDocument();
    rerender(
      <AgentStartScreen
        onConfirm={vi.fn()}
        lastShift={{ logoutTime: '2026-10-15T18:00:00.000Z', totalCalls: 12, totalTalkSec: 3600, totalPauseSec: 600 }}
      />,
    );
    const summary = screen.getByTestId('agent-last-shift');
    expect(summary).toHaveTextContent('12');
    expect(summary).toHaveTextContent('1:00:00');
    expect(summary).toHaveTextContent('10:00');
  });
});
