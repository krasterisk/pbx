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

vi.mock('@/shared/lib/telephony/useAudioDevices', () => ({
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

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { loadDialBuffer } from '@/features/callcenter/lib/shiftSession';
import { toast } from 'react-toastify';

function mockPhone(over: Record<string, unknown> = {}) {
  return {
    status: 'registered',
    callInfo: null,
    isHeld: false,
    isMuted: false,
    quality: { level: 3, mos: 4.1, jitterMs: 12, rttMs: 40, lossPct: 0.2 },
    lastDialFailure: null,
    clearLastDialFailure: vi.fn(),
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
  it('uses an external handset launcher without rendering another launcher and still opens the shared panel', () => {
    const phone = mockPhone();
    const view = render(<SoftphoneWidget phone={phone as any} hideLauncher panelOpen={false} />);
    expect(screen.queryByTestId('softphone-widget-trigger')).not.toBeInTheDocument();
    expect(screen.queryByTestId('softphone-widget-panel')).not.toBeInTheDocument();
    view.rerender(<SoftphoneWidget phone={phone as any} hideLauncher panelOpen />);
    expect(screen.getByTestId('softphone-widget-panel')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(loadDialBuffer).mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('embeds the same dial transport without a launcher or floating window', async () => {
    const phone = mockPhone();
    const started = vi.fn();
    render(<SoftphoneWidget variant="embedded" phone={phone} mode="webrtc" onOutboundDialStarted={started} />);
    expect(screen.getByTestId('softphone-embedded')).toBeInTheDocument();
    expect(screen.queryByTestId('softphone-widget-trigger')).toBeNull();
    expect(screen.queryByTestId('softphone-widget-sticky')).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'callcenter.softphone.dialPlaceholder' }), { target: { value: '202' } });
    fireEvent.click(screen.getByRole('button', { name: 'callcenter.softphone.dial' }));
    await act(async () => {});
    expect(phone.makeCall).toHaveBeenCalledExactlyOnceWith('202');
    expect(started).toHaveBeenCalledExactlyOnceWith('202');
    expect(screen.queryByTestId('softphone-widget-panel')).toBeNull();
  });

  it('receives WebRTC calls in one inline answer area and uses the supplied handler', async () => {
    const phone = mockPhone({ status: 'ringing', callInfo: { from: '202' } });
    const view = render(<SoftphoneWidget variant="embedded" phone={phone} mode="webrtc" />);
    expect(screen.getAllByRole('button', { name: 'callcenter.softphone.answer' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'callcenter.softphone.answer' }));
    expect(phone.acceptCall).toHaveBeenCalledTimes(1);
    view.rerender(<SoftphoneWidget variant="embedded" phone={phone} mode="webrtc" answering />);
    expect(screen.getByRole('button', { name: 'callcenter.softphone.answer' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'callcenter.softphone.reject' })).toBeDisabled();
  });

  it('keeps SIP answer on the device and never exposes a WebRTC answer action', () => {
    const phone = mockPhone({ status: 'ringing', callInfo: { from: '202' } });
    render(<SoftphoneWidget variant="embedded" phone={phone} mode="sip" />);
    expect(screen.getByText('callcenter.softphone.answerOnDeviceInboundHint')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'callcenter.softphone.answer' })).toBeNull();
    expect(screen.queryByTestId('softphone-device-picker')).toBeNull();
    expect(phone.acceptCall).not.toHaveBeenCalled();
  });

  it('retains controls, DTMF, conference and audio tools without duplicating answer or hangup', async () => {
    const phone = mockPhone({ status: 'in-call', callInfo: { from: '202' } });
    render(<SoftphoneWidget variant="embedded" phone={phone} mode="webrtc" activeCallUniqueid="call1"
      callControls={<button onClick={phone.hangup}>Hang up here</button>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hang up here' }));
    expect(phone.hangup).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Add to conference' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'callcenter.softphone.dtmf' }));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(phone.sendDtmf).toHaveBeenCalledWith('5');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'callcenter.softphone.tools' }));
    expect(await screen.findByTestId('softphone-device-picker')).toBeInTheDocument();
    expect(screen.getByTestId('softphone-tab-contacts')).toBeInTheDocument();
    expect(screen.getByTestId('softphone-tab-journal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'callcenter.softphone.answer' })).toBeNull();
  });

  it('bridges pending click-to-call once and keeps the page open', async () => {
    const phone = mockPhone();
    const consumed = vi.fn();
    const started = vi.fn();
    render(<SoftphoneWidget variant="embedded" phone={phone} mode="sip" pendingOutboundDial="203"
      onOutboundDialConsumed={consumed} onOutboundDialStarted={started} />);
    await act(async () => {});
    expect(phone.makeCall).toHaveBeenCalledExactlyOnceWith('203');
    expect(consumed).toHaveBeenCalledTimes(1);
    expect(started).toHaveBeenCalledExactlyOnceWith('203');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not dial pending targets during wrap-up and retries when dialing is allowed', async () => {
    const phone = mockPhone();
    const consumed = vi.fn();
    const view = render(<SoftphoneWidget variant="embedded" phone={phone} dialAllowed={false} pendingOutboundDial="204" onOutboundDialConsumed={consumed} />);
    expect(phone.makeCall).not.toHaveBeenCalled();
    expect(consumed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'callcenter.softphone.dial' })).toBeDisabled();
    view.rerender(<SoftphoneWidget variant="embedded" phone={phone} dialAllowed pendingOutboundDial="204" onOutboundDialConsumed={consumed} />);
    await act(async () => {});
    expect(phone.makeCall).toHaveBeenCalledExactlyOnceWith('204');
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

  it('shows dial failure message and toast when lastDialFailure is set', () => {
    const clearLastDialFailure = vi.fn();
    const phone = mockPhone({
      lastDialFailure: { kind: 'ended_early', target: '800' },
      clearLastDialFailure,
    });
    render(<SoftphoneWidget phone={phone} mode="webrtc" />);
    expect(screen.getByText(/Call dropped immediately/i)).toBeTruthy();
    expect(toast.error).toHaveBeenCalled();
    expect(clearLastDialFailure).toHaveBeenCalled();
  });

  it('shows registration badge online/registering/offline and Recover after timeout', () => {
    vi.useFakeTimers();
    const phone = mockPhone({ status: 'disconnected' });
    const { rerender, unmount } = render(<SoftphoneWidget phone={phone} mode="webrtc" />);
    const badge = screen.getByTestId('softphone-reg-badge');
    expect(badge.getAttribute('data-state')).toBe('offline');

    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
    expect(screen.getByTestId('softphone-reg-banner')).toBeTruthy();
    expect(screen.getByTestId('softphone-widget-panel')).toHaveFocus();
    expect(screen.queryByTestId('softphone-recover')).toBeNull();
    expect(phone.ensureConnected).toHaveBeenCalledWith(true);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId('softphone-recover')).toBeTruthy();
    fireEvent.click(screen.getByTestId('softphone-recover'));
    expect(phone.ensureConnected).toHaveBeenCalledTimes(2);

    expect(screen.queryByTestId('softphone-widget-trigger')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }));
    expect(screen.getByTestId('softphone-widget-trigger')).toHaveFocus();

    rerender(<SoftphoneWidget phone={mockPhone({ status: 'connecting' })} mode="webrtc" />);
    expect(screen.getByTestId('softphone-reg-badge').getAttribute('data-state')).toBe('registering');

    rerender(<SoftphoneWidget phone={mockPhone({ status: 'registered' })} mode="webrtc" />);
    expect(screen.getByTestId('softphone-reg-badge').getAttribute('data-state')).toBe('online');
    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
    expect(screen.queryByTestId('softphone-reg-banner')).toBeNull();

    unmount();

    const onRecover = vi.fn();
    const phoneWithRecover = mockPhone({ status: 'disconnected' });
    render(
      <SoftphoneWidget
        phone={phoneWithRecover}
        mode="webrtc"
        onRecover={onRecover}
      />,
    );
    fireEvent.click(screen.getByTestId('softphone-widget-trigger'));
    expect(onRecover).not.toHaveBeenCalled();
    expect(phoneWithRecover.ensureConnected).toHaveBeenCalledWith(true);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    fireEvent.click(screen.getByTestId('softphone-recover'));
    expect(onRecover).toHaveBeenCalled();
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
