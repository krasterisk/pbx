import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SoftphoneWidget } from './SoftphoneWidget';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/features/callcenter/ui/TransferDirectory', () => ({
  TransferDirectory: () => null,
}));

function mockPhone(over: Record<string, unknown> = {}) {
  return {
    status: 'registered',
    callInfo: null,
    isHeld: false,
    isMuted: false,
    quality: { level: 0, mos: 0, jitterMs: 0, rttMs: 0, lossPct: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    ensureConnected: vi.fn(),
    acceptCall: vi.fn(),
    rejectCall: vi.fn(),
    hangup: vi.fn(),
    makeCall: vi.fn().mockResolvedValue(undefined),
    hold: vi.fn(),
    unhold: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    sendDtmf: vi.fn(),
    blindTransfer: vi.fn(),
    attendedTransfer: vi.fn(),
    ...over,
  } as any;
}

describe('SoftphoneWidget', () => {
  it('expands FAB to a dialpad when registered and dials on Call', async () => {
    const phone = mockPhone();
    render(<SoftphoneWidget phone={phone} />);

    fireEvent.click(screen.getByTestId('softphone-widget-fab'));
    expect(screen.getByTestId('softphone-dialpad')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));

    expect(phone.makeCall).toHaveBeenCalledWith('12');
  });

  it('does not auto-open on ring; answer/reject appear after manual open', () => {
    const phone = mockPhone({ status: 'ringing', callInfo: { from: '201' } });
    render(<SoftphoneWidget phone={phone} />);
    expect(screen.queryByRole('button', { name: /Answer/i })).toBeNull();
    fireEvent.click(screen.getByTestId('softphone-widget-fab'));
    expect(screen.getByRole('button', { name: /Answer/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeTruthy();
  });
});