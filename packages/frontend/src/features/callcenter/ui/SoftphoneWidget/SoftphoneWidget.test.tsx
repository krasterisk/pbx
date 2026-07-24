import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SoftphoneWidget } from './SoftphoneWidget';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { n?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && 'n' in fallback) {
        return `Device ${fallback.n}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/shared/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/features/callcenter/ui/TransferDirectory', () => ({
  TransferDirectory: () => null,
}));

vi.mock('./SoftphoneJournal', () => ({
  SoftphoneJournal: () => <div data-testid="softphone-journal" />,
}));

vi.mock('./SoftphoneContacts', () => ({
  SoftphoneContacts: () => <div data-testid="softphone-contacts" />,
}));

vi.mock('@/features/callcenter/lib/useAudioDevices', () => ({
  useAudioDevices: () => ({
    microphones: [
      { deviceId: 'mic1', label: 'Mic 1', kind: 'audioinput', groupId: '', toJSON: () => ({}) },
    ],
    speakers: [
      { deviceId: 'spk1', label: 'Speaker 1', kind: 'audiooutput', groupId: '', toJSON: () => ({}) },
    ],
    selectedMic: 'default',
    setSelectedMic: vi.fn(),
    selectedSpeaker: 'default',
    setSelectedSpeaker: vi.fn(),
    refresh: vi.fn(),
  }),
  audioDeviceLabel: (d: { label: string }, index: number, kind: string) =>
    d.label || `${kind} ${index + 1}`,
}));

vi.mock('@/features/callcenter/lib/shiftSession', () => ({
  loadDialBuffer: vi.fn(() => null),
  saveDialBuffer: vi.fn(),
}));

import { loadDialBuffer } from '@/features/callcenter/lib/shiftSession';

function mockPhone(over: Record<string, unknown> = {}) {
  return {
    status: 'registered',
    callInfo: null,
    isHeld: false,
    isMuted: false,
    quality: { level: 3, mos: 4.1, jitterMs: 12, rttMs: 40, lossPct: 0.2 },
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
    switchMicrophone: vi.fn().mockResolvedValue(undefined),
    switchSpeaker: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('SoftphoneWidget', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(loadDialBuffer).mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders chrome-only shell with three Tabs (no fab)', async () => {
    const phone = mockPhone();
    const { container } = render(<SoftphoneWidget phone={phone} mode="webrtc" />);

    expect(screen.getByTestId('softphone-widget-chrome')).toBeTruthy();
    expect(screen.queryByTestId('softphone-widget-fab')).toBeNull();
    expect(container.querySelector('[class*="fab"]')).toBeNull();

    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
    expect(screen.getByTestId('softphone-tab-dial')).toBeTruthy();
    expect(screen.getByTestId('softphone-tab-journal')).toBeTruthy();
    expect(screen.getByTestId('softphone-tab-contacts')).toBeTruthy();
  });

  it('expands chrome to a dialpad when registered and dials on Call', async () => {
    const phone = mockPhone();
    render(<SoftphoneWidget phone={phone} mode="webrtc" />);

    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
    expect(screen.getByTestId('softphone-dialpad')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Call' }));

    expect(phone.makeCall).toHaveBeenCalledWith('12');
  });

  it('does not auto-open on ring; answer/reject appear after manual open', () => {
    const phone = mockPhone({ status: 'ringing', callInfo: { from: '201' } });
    render(<SoftphoneWidget phone={phone} mode="webrtc" />);
    expect(screen.queryByRole('button', { name: /Answer/i })).toBeNull();
    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
    expect(screen.getByRole('button', { name: /Answer/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeTruthy();
  });

  it('mounts Journal and Contacts tab content', async () => {
    const user = userEvent.setup();
    const phone = mockPhone();
    render(<SoftphoneWidget phone={phone} mode="webrtc" />);
    await user.click(screen.getByTestId('softphone-widget-trigger'));

    await user.click(screen.getByTestId('softphone-tab-journal'));
    expect(screen.getByTestId('softphone-journal')).toBeTruthy();

    await user.click(screen.getByTestId('softphone-tab-contacts'));
    expect(screen.getByTestId('softphone-contacts')).toBeTruthy();
  });

  it('enables Redial when lastNumber exists and dials it', async () => {
    vi.mocked(loadDialBuffer).mockReturnValue({ dialBuffer: '', lastNumber: '5551234' });

    const phone = mockPhone();
    render(<SoftphoneWidget phone={phone} mode="webrtc" />);
    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));

    const redial = screen.getByTestId('softphone-redial');
    expect(redial).not.toBeDisabled();
    fireEvent.click(redial);
    expect(phone.makeCall).toHaveBeenCalledWith('5551234');
  });

  it('shows registration badge online/registering/offline and Recover after timeout', () => {
    vi.useFakeTimers();
    const phone = mockPhone({ status: 'disconnected' });
    const { rerender } = render(<SoftphoneWidget phone={phone} mode="webrtc" />);
    const badge = screen.getByTestId('softphone-reg-badge');
    expect(badge.getAttribute('data-state')).toBe('offline');

    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
    expect(screen.getByTestId('softphone-reg-banner')).toBeTruthy();
    expect(screen.queryByTestId('softphone-recover')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId('softphone-recover')).toBeTruthy();
    fireEvent.click(screen.getByTestId('softphone-recover'));
    expect(phone.ensureConnected).toHaveBeenCalledWith(true);

    rerender(<SoftphoneWidget phone={mockPhone({ status: 'connecting' })} mode="webrtc" />);
    expect(screen.getByTestId('softphone-reg-badge').getAttribute('data-state')).toBe('registering');

    rerender(<SoftphoneWidget phone={mockPhone({ status: 'registered' })} mode="webrtc" />);
    expect(screen.getByTestId('softphone-reg-badge').getAttribute('data-state')).toBe('online');
    expect(screen.queryByTestId('softphone-reg-banner')).toBeNull();
  });

  it('renders quality + device picker in WebRTC mode and omits both in SIP mode', () => {
    const phone = mockPhone({ status: 'in-call', callInfo: { from: '201' } });
    const { rerender } = render(<SoftphoneWidget phone={phone} mode="webrtc" />);
    expect(screen.getByTestId('softphone-quality-compact')).toBeTruthy();

    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
    expect(screen.getByTestId('softphone-quality-detail')).toBeTruthy();
    expect(screen.getByTestId('softphone-device-picker')).toBeTruthy();

    rerender(<SoftphoneWidget phone={phone} mode="sip" />);
    expect(screen.queryByTestId('softphone-quality-compact')).toBeNull();
    expect(screen.queryByTestId('softphone-quality-detail')).toBeNull();
    expect(screen.queryByTestId('softphone-device-picker')).toBeNull();
  });

  it('shows inline device-switch error on failure', async () => {
    const phone = mockPhone({
      switchMicrophone: vi.fn().mockRejectedValue(new Error('fail')),
    });
    render(<SoftphoneWidget phone={phone} mode="webrtc" />);
    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));

    fireEvent.change(screen.getByTestId('softphone-mic-select'), { target: { value: 'mic1' } });
    expect(await screen.findByTestId('softphone-device-error')).toBeTruthy();
    expect(screen.getByTestId('softphone-device-error').textContent).toMatch(/Could not switch device/i);
  });
});
