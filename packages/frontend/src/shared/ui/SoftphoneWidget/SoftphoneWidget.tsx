import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslateFn } from '@/shared/lib/translateFn';
import { toast } from 'react-toastify';
import {
  Phone, PhoneOff, Users, Pause, Play, Mic, MicOff,
  BookUser, History, RotateCcw, Eraser, Grip, X, MoveDiagonal2, SlidersHorizontal, Headphones, Delete as DeleteIcon,
} from 'lucide-react';
import {
  Button, Input, Label, Text, HStack, VStack, Tooltip, Select, Tabs, TabsList, TabsTrigger, TabsContent,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/shared/ui';
import { DialpadGrid, DIALPAD_KEYS } from './DialpadGrid';
import { DtmfKeypad } from './DtmfKeypad';
import { CallQualityIndicator } from './CallQualityIndicator';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useFloatingWindow } from '@/shared/hooks/useFloatingWindow';
import {
  audioDeviceLabel,
  useAudioDevices,
} from '@/shared/lib/telephony/useAudioDevices';
import type { CallQuality, DialFailure } from '@/shared/lib/telephony/useWebRTCPhone';
import styles from './SoftphoneWidget.module.scss';
import handsetImage from './assets/softphone-handset.png';

/** Chrome-only softphone shell (D-26). */
export type SoftphoneVariant = 'chrome' | 'embedded';
export type SoftphoneMode = 'webrtc' | 'sip';
type SoftphoneTab = 'dial' | 'journal' | 'contacts';

/**
 * Transport-agnostic phone contract. SoftphoneWidget imports neither useWebRTCPhone
 * nor useSipPhoneAmi - both hooks satisfy this by shape (D-31 / Anti-Pattern 1).
 */
export interface SoftphoneWidgetPhone {
  status: string;
  callInfo: { from?: string; to?: string } | null;
  isHeld: boolean;
  isMuted: boolean;
  hangup: () => void | Promise<void>;
  hold: () => void | Promise<void>;
  unhold: () => void | Promise<void>;
  mute: () => void;
  unmute: () => void;
  sendDtmf: (digit: string) => void | Promise<void>;
  makeCall: (target: string) => Promise<void>;
  /** WebRTC-only optional fields */
  quality?: CallQuality;
  lastDialFailure?: DialFailure | null;
  clearLastDialFailure?: () => void;
  ensureConnected?: (force?: boolean) => void | Promise<void>;
  acceptCall?: () => void | Promise<void>;
  rejectCall?: () => void | Promise<void>;
  switchMicrophone?: (deviceId: string) => Promise<void>;
  switchSpeaker?: (deviceId: string) => Promise<void>;
}

export interface SoftphoneWidgetProps {
  className?: string;
  journalContent?: ReactNode;
  contactsContent?: ReactNode;
  renderConference?: (onDone: () => void) => ReactNode;
  dialBufferStorage?: { load: () => { dialBuffer?: string } | null; save: (value: {dialBuffer:string;lastNumber:string}) => void };
  sessionControls?: ReactNode;
  connectionContent?: ReactNode;
  panelOpen?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  standaloneControls?: boolean;
  autoOpenIncoming?: boolean;
  dialAllowed?: boolean;
  /** Structural phone interface - widget only renders it, never forks call logic. */
  phone: SoftphoneWidgetPhone;
  /** Gates quality + device picker (D-34). Defaults to webrtc for backward compatibility. */
  mode?: SoftphoneMode;
  callerName?: string;
  queueLabel?: string;
  /** Elapsed call seconds, owned by the page orchestrator's timer. */
  callSeconds?: number;
  /** Presentation only; both variants use the same supplied phone/session. */
  variant?: SoftphoneVariant;
  /** Operator-owned controls (transfer, hold, park, etc.) in the integrated call row. */
  callControls?: ReactNode;
  idleLabel?: string;
  idleHint?: string;
  answering?: boolean;
  /** Show text label next to the chrome trigger (e.g. "Softphone"). */
  showLabel?: boolean;
  /** Movable launcher for the ordinary-user phone; operator chrome stays docked. */
  floating?: boolean;
  visible?: boolean;
  hideLauncher?: boolean;
  onOpenCard?: () => void;
  /**
   * uniqueid of the operator's own active call - required for the built-in
   * "Add to conference" control (D-28, 09-10→09-12 key link). Omit/undefined
   * degrades the control to disabled (no active call, nothing to conference).
   */
  activeCallUniqueid?: string;
  /** Parent Recover handler (re-fetch credentials + full connect). Falls back to phone.ensureConnected. */
  onRecover?: () => void | Promise<void>;
  /**
   * Outbound target requested by click-to-call / history (WebRTC mode).
   * Softphone consumes and dials, then calls onOutboundDialConsumed.
   */
  pendingOutboundDial?: string | null;
  onOutboundDialConsumed?: () => void;
  /** Persist preferred mic when operator picks a device mid-shift (WebRTC). */
  onMicDeviceChange?: (deviceId: string | undefined) => void;
  /** Persist preferred speaker when operator picks a device mid-shift (WebRTC). */
  onSpeakerDeviceChange?: (deviceId: string | undefined) => void;
  /**
   * Called after a successful outbound dial attempt so SIP mode can show
   * "answer on device" chrome before AMI SSE catches up.
   */
  onOutboundDialStarted?: (target: string) => void;
}

const RECOVER_TIMEOUT_MS = 10_000;

/** WebRTC-only device rows - isolated so SIP mode never mounts useAudioDevices. */
function SoftphoneDevicePicker({
  phone,
  deviceError,
  onDeviceError,
  onMicDeviceChange,
  onSpeakerDeviceChange,
}: {
  phone: SoftphoneWidgetPhone;
  deviceError: string | null;
  onDeviceError: (msg: string | null) => void;
  onMicDeviceChange?: (deviceId: string | undefined) => void;
  onSpeakerDeviceChange?: (deviceId: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const audioDevices = useAudioDevices();

  const handleMicChange = async (deviceId: string) => {
    onDeviceError(null);
    audioDevices.setSelectedMic(deviceId);
    const preferred = deviceId === 'default' ? undefined : deviceId;
    onMicDeviceChange?.(preferred);
    if (!phone.switchMicrophone) return;
    try {
      await phone.switchMicrophone(deviceId);
    } catch {
      onDeviceError(t('callcenter.softphone.deviceSwitchFailed', 'Could not switch device'));
    }
  };

  const handleSpeakerChange = async (deviceId: string) => {
    onDeviceError(null);
    audioDevices.setSelectedSpeaker(deviceId);
    const preferred = deviceId === 'default' ? undefined : deviceId;
    onSpeakerDeviceChange?.(preferred);
    if (!phone.switchSpeaker) return;
    try {
      await phone.switchSpeaker(deviceId);
    } catch {
      onDeviceError(t('callcenter.softphone.deviceSwitchFailed', 'Could not switch device'));
    }
  };

  return (
    <VStack gap="8" className={styles.devicePicker} data-testid="softphone-device-picker">
      <Label className={styles.deviceRow}>
        <Text className={styles.deviceLabel}>{t('callcenter.softphone.microphone', 'Microphone')}</Text>
        <Select
          value={audioDevices.selectedMic}
          onChange={(e) => void handleMicChange(e.target.value)}
          aria-label={t('callcenter.softphone.microphone', 'Microphone')}
          data-testid="softphone-mic-select"
        >
          <option value="default">{t('callcenter.softphone.defaultDevice')}</option>
          {audioDevices.microphones.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {audioDeviceLabel(d, i, 'mic', `${t('callcenter.softphone.microphone')} ${i + 1}`)}
            </option>
          ))}
        </Select>
      </Label>
      <Label className={styles.deviceRow}>
        <Text className={styles.deviceLabel}>{t('callcenter.softphone.speaker', 'Speaker')}</Text>
        <Select
          value={audioDevices.selectedSpeaker}
          onChange={(e) => void handleSpeakerChange(e.target.value)}
          aria-label={t('callcenter.softphone.speaker', 'Speaker')}
          data-testid="softphone-speaker-select"
        >
          <option value="default">{t('callcenter.softphone.defaultDevice')}</option>
          {audioDevices.speakers.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {audioDeviceLabel(d, i, 'speaker', `${t('callcenter.softphone.speaker')} ${i + 1}`)}
            </option>
          ))}
        </Select>
      </Label>
      {deviceError ? (
        <Text variant="muted" className={styles.deviceError} data-testid="softphone-device-error">
          {deviceError}
        </Text>
      ) : null}
    </VStack>
  );
}

function formatCallTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type RegVisual = 'online' | 'registering' | 'offline';

function registrationVisual(status: string, mode: SoftphoneMode): RegVisual {
  if (status === 'registered' || status === 'in-call' || status === 'ringing' || status === 'dialing') {
    return 'online';
  }
  if (status === 'connecting') return 'registering';
  if (status === 'disconnected') return 'offline';
  // SIP binary presence: treat unknown as offline (D-35 - no registering in SIP)
  if (mode === 'sip') return status === 'online' ? 'online' : 'offline';
  return 'offline';
}

function dialFailureMessage(
  failure: DialFailure,
  t: TranslateFn,
): string {
  switch (failure.kind) {
    case 'microphone':
      return t('phoneNumber.microphoneUnavailable', 'Microphone unavailable. Allow access in your browser and check the selected device.');
    case 'busy':
      return t('callcenter.softphone.dialFailedBusy', 'Line is busy');
    case 'not_found':
      return t('callcenter.softphone.dialFailedNotFound', 'Number not found');
    case 'unavailable':
      return t('callcenter.softphone.dialFailedUnavailable', 'Subscriber unavailable');
    case 'declined':
      return t('callcenter.softphone.dialFailedDeclined', 'Call declined');
    case 'ended_early':
      return t(
        'callcenter.softphone.dialFailedEndedEarly',
        'Call dropped immediately - check the number or dialplan route',
      );
    case 'rejected':
      return failure.statusCode
        ? `${t('callcenter.softphone.dialFailed', 'Could not place call')} (${failure.statusCode})`
        : t('callcenter.softphone.dialFailed', 'Could not place call');
    default:
      return t('callcenter.softphone.dialFailed', 'Could not place call');
  }
}

export function SoftphoneWidget({
  className,
  journalContent, contactsContent, renderConference, dialBufferStorage, sessionControls,
  connectionContent, panelOpen, onPanelOpenChange,
  standaloneControls = false, autoOpenIncoming = false, dialAllowed = true,
  phone,
  mode = 'webrtc',
  callerName,
  queueLabel,
  callSeconds = 0,
  variant = 'chrome',
  callControls,
  idleLabel,
  idleHint,
  answering = false,
  showLabel = false,
  floating = false,
  visible = true,
  hideLauncher = false,
  onOpenCard,
  activeCallUniqueid,
  onRecover,
  pendingOutboundDial,
  onOutboundDialConsumed,
  onMicDeviceChange,
  onSpeakerDeviceChange,
  onOutboundDialStarted,
}: SoftphoneWidgetProps) {
  const { t } = useTranslation();
  const embedded = variant === 'embedded';
  const isMobile = useIsMobile(768);
  const mobileFloating = useFloatingWindow(60, () => 60, 'softphone-widget-geometry', 768, 168);
  const [windowWidth, setWindowWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('softphone-window-width'));
      return Number.isFinite(saved) && saved >= 360 ? Math.min(saved, 720, window.innerWidth - 32) : 360;
    } catch { return 360; }
  });
  const changeWindowWidth = useCallback((requested: number) => {
    const width = Math.min(Math.max(360, requested), 720, window.innerWidth - 32);
    setWindowWidth(width);
    try { localStorage.setItem('softphone-window-width', String(width)); } catch { /* Optional storage. */ }
    return width;
  }, []);
  const desktopWindow = useFloatingWindow(windowWidth, changeWindowWidth, 'softphone-window-geometry', 768);
  const cancelWindowGesture = desktopWindow.cancelGesture;
  const [localOpen, setLocalOpen] = useState(false);
  const open = panelOpen ?? localOpen;
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyOpen = useRef(open);
  useEffect(() => {
    if (isMobile || embedded) return;
    if (open) panelRef.current?.focus();
    else if (previouslyOpen.current) launcherRef.current?.focus();
    previouslyOpen.current = open;
  }, [open, isMobile, embedded]);
  const panelState = useRef({ open, onPanelOpenChange });
  panelState.current = { open, onPanelOpenChange };
  const setOpen = useCallback((next: boolean | ((previous: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(panelState.current.open) : next;
    setLocalOpen(value);
    panelState.current.onPanelOpenChange?.(value);
  }, []);
  useEffect(() => {
    if (!open || isMobile) cancelWindowGesture();
  }, [open, isMobile, cancelWindowGesture]);
  const mobileDialOpen = open;
  const setMobileDialOpen = setOpen;
  const [conferenceOpen, setConferenceOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [dialError, setDialError] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SoftphoneTab>('dial');
  const needsConnection = Boolean(connectionContent);
  useEffect(() => { if (needsConnection) setActiveTab('dial'); }, [needsConnection]);
  const [recoverAvailable, setRecoverAvailable] = useState(false);

  const isWebrtc = mode === 'webrtc';

  const isRinging = phone.status === 'ringing';
  const isDialing = phone.status === 'dialing';
  const isInCall = phone.status === 'in-call';
  const isIdle =
    phone.status === 'registered'
    || phone.status === 'connecting'
    || phone.status === 'disconnected';
  const canDial = phone.status === 'registered' && dialAllowed;
  const regVisual = registrationVisual(phone.status, mode);
  const showRegBanner = regVisual === 'registering' || regVisual === 'offline';
  const pulseActive = isRinging || isDialing;

  const callerLabel =
    callerName
    || phone.callInfo?.to
    || phone.callInfo?.from
    || (isDialing || isInCall
      ? t('callcenter.softphone.unknownParty', 'Unknown')
      : t('callcenter.noActiveCall'));

  const dialingHint = mode === 'sip'
    ? t(
      'callcenter.softphone.answerOnDevice',
      'Answer the call on your SIP phone or softphone client',
    )
    : t('callcenter.softphone.calling', 'Calling…');

  // SIP desk phone: Answer/Reject are WebRTC-only - inbound ring is answered on the handset.
  const showWebRtcRingActions = isRinging && mode === 'webrtc';
  const showSipDeviceHint = mode === 'sip' && (isDialing || isRinging);

  // Restore dial buffer after F5 (D-19)
  useEffect(() => {
    const saved = dialBufferStorage?.load();
    if (!saved) return;
    if (saved.dialBuffer) setDialNumber(saved.dialBuffer);
  }, [dialBufferStorage]);

  // Persist dial buffer on change
  useEffect(() => {
    dialBufferStorage?.save({ dialBuffer: dialNumber, lastNumber: dialNumber });
  }, [dialNumber, dialBufferStorage]);

  // Recover CTA only after silent auto-retry window (D-16)
  useEffect(() => {
    if (!showRegBanner) {
      setRecoverAvailable(false);
      return;
    }
    setRecoverAvailable(false);
    const timer = window.setTimeout(() => setRecoverAvailable(true), RECOVER_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [showRegBanner, phone.status]);

  // Outbound dial failed / dialplan Hangup - surface reason on dialpad + toast
  useEffect(() => {
    const failure = phone.lastDialFailure;
    if (!failure) return;
    const message = dialFailureMessage(failure, t);
    setDialError(message);
    setActiveTab('dial');
    if (!embedded) setOpen(true);
    if (!embedded && isMobile) setMobileDialOpen(true);
    toast.error(message);
    phone.clearLastDialFailure?.();
  }, [phone.lastDialFailure, phone, t, isMobile, embedded, setOpen, setMobileDialOpen]);

  // Auto-expand only for outbound dialing (already interacting with softphone).
  // Incoming ring: toast only - softphone opens manually (avoids duplicate UI).
  useEffect(() => {
    if (!embedded && (isDialing || (isRinging && autoOpenIncoming))) {
      setOpen(true);
      setActiveTab('dial');
      if (isMobile) setMobileDialOpen(true);
    }
  }, [isDialing, isRinging, autoOpenIncoming, isMobile, embedded, setOpen, setMobileDialOpen]);

  // Once connected, reveal the client workspace. The operator can reopen the dialpad for DTMF.
  useEffect(() => { if (isInCall && !standaloneControls) { setOpen(false); setMobileDialOpen(false); } }, [isInCall, standaloneControls, setOpen, setMobileDialOpen]);

  // Opening the panel while offline - soft reconnect only (no credential refetch).
  const openReconnectNudgedRef = useRef(false);
  useEffect(() => {
    if (!open && !mobileDialOpen) {
      openReconnectNudgedRef.current = false;
      return;
    }
    if (phone.status !== 'disconnected') return;
    if (openReconnectNudgedRef.current) return;
    openReconnectNudgedRef.current = true;
    // WebRTC: soft reconnect UA; SIP: refetch AMI DeviceState registration.
    void phone.ensureConnected?.(true);
    // Intentionally omit `phone` object - only react to open/status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mobileDialOpen, phone.status]);

  // Click-to-call / history → WebRTC INVITE bridge
  const consumedDialRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingOutboundDial) { consumedDialRef.current = null; return; }
    if (!pendingOutboundDial || !canDial) return;
    const target = pendingOutboundDial;
    if (consumedDialRef.current === target) return;
    consumedDialRef.current = target;
    onOutboundDialConsumed?.();
    setDialNumber(target);
    setDialError(null);
    if (!embedded) setOpen(true);
    setActiveTab('dial');
    if (!embedded && isMobile) setMobileDialOpen(true);
    void phone.makeCall(target).then(() => {
      onOutboundDialStarted?.(target);
    }).catch(() => {
      setDialError(t('callcenter.softphone.dialFailed', 'Could not place call'));
    });
  }, [pendingOutboundDial, canDial, phone, onOutboundDialConsumed, onOutboundDialStarted, t, isMobile, embedded, setOpen, setMobileDialOpen]);

  // Hardware keyboard → dial buffer while idle / DTMF while in-call (Dial tab only)
  useEffect(() => {
    if (!open && !mobileDialOpen) return;
    if (activeTab !== 'dial') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLSelectElement) return;
      if (isInCall) {
        if (DIALPAD_KEYS.includes(e.key as (typeof DIALPAD_KEYS)[number])) {
          e.preventDefault();
          void phone.sendDtmf(e.key);
        }
        return;
      }
      if (!isIdle || !canDial) return;
      if (DIALPAD_KEYS.includes(e.key as (typeof DIALPAD_KEYS)[number])) {
        e.preventDefault();
        setDialNumber((prev) => prev + e.key);
        setDialError(null);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setDialNumber((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        const target = dialNumber.trim();
        if (!target) return;
        e.preventDefault();
        setDialError(null);
        void phone.makeCall(target).then(() => {
          onOutboundDialStarted?.(target);
        }).catch(() => {
          setDialError(t('callcenter.softphone.dialFailed', 'Could not place call'));
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, mobileDialOpen, activeTab, isInCall, isIdle, canDial, dialNumber, phone, onOutboundDialStarted, t]);

  const handleDigit = useCallback((digit: string) => {
    if (isInCall) {
      void phone.sendDtmf(digit);
      return;
    }
    if (!isIdle) return;
    setDialNumber((prev) => prev + digit);
    setDialError(null);
  }, [isInCall, isIdle, phone]);

  const handleBackspace = useCallback(() => {
    setDialNumber((prev) => prev.slice(0, -1));
  }, []);

  const handleClearDial = useCallback(() => {
    setDialNumber('');
    setDialError(null);
  }, []);

  const handleDial = useCallback(async () => {
    const target = dialNumber.trim();
    if (!target || !canDial) return;
    setDialError(null);
    try {
      await phone.makeCall(target);
      onOutboundDialStarted?.(target);
    } catch {
      setDialError(t('callcenter.softphone.dialFailed', 'Could not place call'));
    }
  }, [dialNumber, canDial, phone, onOutboundDialStarted, t]);

  const handleRecover = useCallback(() => {
    void (onRecover?.() ?? phone.ensureConnected?.(true));
  }, [onRecover, phone]);

  if (!visible) return null;

  const regBadgeClass =
    regVisual === 'online'
      ? styles.regBadgeOnline
      : regVisual === 'registering'
        ? styles.regBadgeRegistering
        : styles.regBadgeOffline;

  const regBadgeLabel =
    regVisual === 'online'
      ? t('callcenter.registration.online', 'Online')
      : regVisual === 'registering'
        ? t('callcenter.registration.registering', 'Registering...')
        : t('callcenter.registration.offline', 'Offline');

  const qualityBlock = isWebrtc && phone.quality && isInCall ? (
    <div className={styles.qualityDetail} data-testid="softphone-quality-detail">
      <CallQualityIndicator quality={phone.quality} />
      {phone.quality.level > 0 && <Text className={styles.qualityMetrics}>
        {t('callcenter.softphone.mos')}: {phone.quality.mos.toFixed(1)}
        {' · '}
        {t('callcenter.softphone.jitter')}: {phone.quality.jitterMs} {t('callcenter.softphone.milliseconds')}
        {' · '}
        {t('callcenter.softphone.rtt')}: {phone.quality.rttMs} {t('callcenter.softphone.milliseconds')}
        {' · '}
        {t('callcenter.softphone.loss')}: {phone.quality.lossPct}%
      </Text>}
    </div>
  ) : null;

  // Mounted only in WebRTC mode so useAudioDevices never runs under SIP (T-10-08-01 / D-34).
  const devicePicker = isWebrtc ? (
    <SoftphoneDevicePicker
      phone={phone}
      deviceError={deviceError}
      onDeviceError={setDeviceError}
      onMicDeviceChange={onMicDeviceChange}
      onSpeakerDeviceChange={onSpeakerDeviceChange}
    />
  ) : null;

  const registrationBanner = showRegBanner ? (
    <div
      className={`${styles.regBanner} ${regVisual === 'registering' ? styles.regBannerWarning : styles.regBannerDanger}`}
      data-testid="softphone-reg-banner"
      role="status"
    >
      <Text className={styles.regBannerText}>
        {regVisual === 'registering' || !recoverAvailable
          ? (isWebrtc
            ? t('callcenter.registration.bannerReconnecting', 'Reconnecting the softphone...')
            : t('callcenter.registration.bannerCheckingSip', 'Checking phone registration...'))
          : (isWebrtc
            ? t('callcenter.registration.bannerRecover', 'Could not restore registration. Press "Recover"')
            : t(
              'callcenter.registration.bannerRecoverSip',
              'Could not confirm desk phone registration. Press "Recover"',
            ))}
      </Text>
      {recoverAvailable ? (
        <Button
          size="sm"
          variant="outline"
          onClick={handleRecover}
          data-testid="softphone-recover"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          {t('callcenter.softphone.recover', 'Recover')}
        </Button>
      ) : null}
    </div>
  ) : null;

  const controlsRow = (
    <div className={styles.controlsRow}>
      <DtmfKeypad onDigit={handleDigit} disabled={!isInCall} />
      {standaloneControls && <>
        <Button variant="outline" size="sm" onClick={() => void (phone.isHeld ? phone.unhold() : phone.hold())} aria-label={t('callcenter.softphone.hold', 'Hold')}>
          {phone.isHeld ? <Play className="w-4 h-4"/> : <Pause className="w-4 h-4"/>}
        </Button>
        <Button variant="outline" size="sm" onClick={() => phone.isMuted ? phone.unmute() : phone.mute()} aria-label={t('callcenter.softphone.mute', 'Mute')}>
          {phone.isMuted ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}
        </Button>
        <Button variant="destructive" size="sm" onClick={() => void phone.hangup()} aria-label={t('callcenter.softphone.hangup', 'Hang up')}><PhoneOff className="w-4 h-4"/></Button>
      </>}
      {renderConference ? (<Tooltip content={t('callcenter.controlBar.conferenceHint', 'Add another party to this call')}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConferenceOpen(true)}
          disabled={!isInCall || !activeCallUniqueid}
          aria-label={t('callcenter.controlBar.conference', 'Add to conference')}
        >
          <Users className="w-4 h-4" />
        </Button>
      </Tooltip>) : null}
    </div>
  );

  const ringingActions = showWebRtcRingActions ? (
    <div className={styles.ringingActions}>
      <Button size="lg" className={styles.ringingBtn} disabled={answering} onClick={() => void phone.acceptCall?.()}>
        <Phone className="w-4 h-4 mr-1" />
        {t('callcenter.softphone.answer')}
      </Button>
      <Button variant="destructive" size="lg" className={styles.ringingBtn} disabled={answering} onClick={() => void phone.rejectCall?.()}>
        <PhoneOff className="w-4 h-4 mr-1" />
        {t('callcenter.softphone.reject')}
      </Button>
    </div>
  ) : null;

  const dialPadBlock = (
    <VStack gap="8" className={styles.dialBlock} data-testid="softphone-dialpad">
      <div className={styles.dialDisplay}>
        <Input
          className={styles.dialInput}
          value={dialNumber}
          onChange={(e) => {
            setDialNumber(e.target.value.replace(/[^\d+*#]/g, ''));
            setDialError(null);
          }}
          placeholder={t('callcenter.softphone.dialPlaceholder', 'Enter number')}
          inputMode="tel"
          autoComplete="off"
          aria-label={t('callcenter.softphone.dialPlaceholder', 'Enter number')}
          disabled={!canDial}
        />
        <HStack gap="0" className={styles.dialEditActions}>
          <Tooltip side="top" content={t('callcenter.softphone.backspaceHint')}>
            <span className={styles.dialEditTrigger} tabIndex={!dialNumber || !canDial ? 0 : undefined}>
              <Button variant="ghost" size="icon" className={styles.dialEditButton}
                onClick={handleBackspace} disabled={!dialNumber || !canDial}
                aria-label={t('callcenter.softphone.backspace', 'Backspace')}>
                <DeleteIcon size={16} aria-hidden />
              </Button>
            </span>
          </Tooltip>
          <Tooltip side="top" content={t('callcenter.softphone.clearDialHint')}>
            <span className={styles.dialEditTrigger} tabIndex={!dialNumber || !canDial ? 0 : undefined}>
              <Button variant="ghost" size="icon" className={styles.dialEditButton}
                onClick={handleClearDial} disabled={!dialNumber || !canDial}
                aria-label={t('callcenter.softphone.clearDial', 'Clear')}
                data-testid="softphone-clear-dial">
                <Eraser size={16} aria-hidden />
              </Button>
            </span>
          </Tooltip>
        </HStack>
      </div>
      <DialpadGrid onDigit={handleDigit} disabled={!canDial} className={styles.dialGrid} />
      {dialError ? <Text variant="muted" className={styles.dialError}>{dialError}</Text> : null}
      <HStack gap="8" className={styles.dialActions}>
        <Button
          size="lg"
          className={styles.dialCallBtn}
          onClick={() => void handleDial()}
          disabled={!canDial || !dialNumber.trim()}
        >
          <Phone className="w-4 h-4 mr-1" />
          {t('callcenter.softphone.dial', 'Call')}
        </Button>
      </HStack>
      {devicePicker}
    </VStack>
  );

  const dialTabContent = (
    <>
      {isInCall || isRinging || isDialing ? (
        <VStack gap="4" align="center" className={styles.callSummary}>
          <Text className={styles.callTimerDisplay}>
            {isDialing || showSipDeviceHint ? dialingHint : formatCallTime(callSeconds)}
          </Text>
          <Text className={styles.callerNumber}>{callerLabel}</Text>
          {showSipDeviceHint ? (
            <Text variant="muted" className="text-xs text-center px-2">
              {isDialing
                ? t(
                  'callcenter.softphone.answerOnDeviceHint',
                  'Click-to-call is ringing your device - pick up to connect the callee',
                )
                : t(
                  'callcenter.softphone.answerOnDeviceInboundHint',
                  'Incoming call - answer on your SIP phone or softphone client',
                )}
            </Text>
          ) : null}
          {queueLabel && !isDialing && !showSipDeviceHint ? (
            <span className={styles.queueTag}>{queueLabel}</span>
          ) : null}
          {qualityBlock}
        </VStack>
      ) : (
        dialPadBlock
      )}
      {isInCall || isRinging || isDialing ? devicePicker : null}
      {ringingActions}
      {isDialing || (mode === 'sip' && isRinging) ? (
        <Button variant="destructive" size="lg" onClick={() => void phone.hangup()}>
          <PhoneOff className="w-4 h-4 mr-1" />
          {t('callcenter.softphone.cancelDial', 'Cancel')}
        </Button>
      ) : null}
      {isInCall ? <>{callControls}{controlsRow}</> : null}
      {isInCall && onOpenCard ? (
        <Button variant="outline" size="sm" onClick={onOpenCard}>
          {t('callcenter.cards.popup.openManual')}
        </Button>
      ) : null}
    </>
  );

  const panelBody = (
    <VStack gap="12" className={styles.panelBody}>
      {sessionControls}
      {!connectionContent && registrationBanner}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as SoftphoneTab)}
        className={styles.softphoneTabs}
      >
        <TabsList aria-label={t('callcenter.softphone.tabsLabel', 'Softphone sections')}>
          <TabsTrigger value="dial" data-testid="softphone-tab-dial">
            <Phone className="w-3.5 h-3.5" />
            {t('callcenter.softphone.tabDial', 'Dial')}
          </TabsTrigger>
          {journalContent ? (<TabsTrigger value="journal" data-testid="softphone-tab-journal">
            <History className="w-3.5 h-3.5" />
            {t('callcenter.softphone.tabJournal', 'Journal')}
          </TabsTrigger>) : null}
          {contactsContent ? (<TabsTrigger value="contacts" data-testid="softphone-tab-contacts">
            <BookUser className="w-3.5 h-3.5" />
            {t('callcenter.softphone.tabContacts', 'Contacts')}
          </TabsTrigger>) : null}
        </TabsList>
        <TabsContent value="dial" className={styles.tabPanel}>{connectionContent ?? (embedded ? isIdle ? dialPadBlock : <VStack gap="12" align="stretch">
          <DialpadGrid onDigit={handleDigit} disabled={!isInCall} className={styles.dialGrid} />
          {qualityBlock}{devicePicker}
        </VStack> : dialTabContent)}</TabsContent>
        <TabsContent value="journal" className={styles.tabPanel} data-testid="softphone-journal-panel">
          {journalContent}
        </TabsContent>
        <TabsContent value="contacts" className={styles.tabPanel} data-testid="softphone-contacts-panel">
          {contactsContent}
        </TabsContent>
      </Tabs>
    </VStack>
  );

  const conferenceSheet = (
    <Sheet open={conferenceOpen} onOpenChange={setConferenceOpen}>
      <SheetContent className={styles.conferenceSheet}>
        <SheetHeader>
          <SheetTitle>{t('callcenter.controlBar.conference', 'Add to conference')}</SheetTitle>
        </SheetHeader>
        {renderConference?.(() => setConferenceOpen(false))}
      </SheetContent>
    </Sheet>
  );

  const stickyDotClass = pulseActive
    ? styles.stickyDotRinging
    : isInCall
      ? styles.stickyDotInCall
      : regVisual === 'online'
        ? styles.stickyDotOnline
        : regVisual === 'registering'
          ? styles.stickyDotRegistering
          : styles.stickyDotOffline;

  if (embedded) {
    const hasCall = isInCall || isRinging || isDialing || Boolean(callControls);
    const partyNumber = phone.callInfo?.to || phone.callInfo?.from;
    return <VStack align="stretch" className={`${styles.embedded} ${className ?? ''}`} data-testid="softphone-embedded" data-idle={!hasCall}>
      {registrationBanner}
      <HStack gap="16" max className={styles.embeddedRow}>
        <HStack gap="12" className={styles.embeddedIdentity}>
          <HStack justify="center" className={styles.embeddedIcon}><Headphones size={20} aria-hidden /></HStack>
          <VStack gap="4" className={styles.embeddedCaller}>
            <Text className={styles.embeddedTitle}>{hasCall ? callerLabel : (idleLabel || t('callcenter.softphone.readyForCall'))}</Text>
            <Text variant="muted" className={styles.embeddedHint}>
              {showSipDeviceHint ? (isDialing ? t('callcenter.softphone.answerOnDeviceHint') : t('callcenter.softphone.answerOnDeviceInboundHint'))
                : hasCall ? [partyNumber !== callerLabel ? partyNumber : null, queueLabel, isRinging ? t('callcenter.softphone.incoming') : isDialing ? t('callcenter.softphone.calling') : formatCallTime(callSeconds)].filter(Boolean).join(' · ')
                  : idleHint || t('callcenter.softphone.panelTitle')}
            </Text>
          </VStack>
        </HStack>
        {!hasCall && <HStack gap="8" className={styles.embeddedDial}>
          <Input value={dialNumber} inputMode="tel" autoComplete="off" disabled={!canDial}
            aria-label={t('callcenter.softphone.dialPlaceholder')} placeholder={t('callcenter.softphone.dialPlaceholder')}
            onChange={event => { setDialNumber(event.target.value.replace(/[^\d+*#]/g, '')); setDialError(null); }}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void handleDial(); } }} />
          <Button disabled={!canDial || !dialNumber.trim()} onClick={() => void handleDial()}><Phone size={16} aria-hidden />{t('callcenter.softphone.dial')}</Button>
        </HStack>}
        <HStack gap="8" className={styles.embeddedActions}>
          {ringingActions}
          {callControls}
          {isInCall && controlsRow}
          {(isDialing || (mode === 'sip' && isRinging)) && !callControls && <Button variant="destructive" onClick={() => void phone.hangup()}><PhoneOff size={16} aria-hidden />{t('callcenter.softphone.cancelDial')}</Button>}
          <Tooltip content={t('callcenter.softphone.tools')}><Button variant="ghost" size="icon" aria-label={t('callcenter.softphone.tools')}
            onClick={() => setOpen(true)}><SlidersHorizontal size={18} aria-hidden /></Button></Tooltip>
        </HStack>
      </HStack>
      {dialError && <Text variant="error" role="alert">{dialError}</Text>}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className={styles.embeddedTools}>
          <SheetHeader><SheetTitle>{t('callcenter.softphone.tools')}</SheetTitle></SheetHeader>
          {panelBody}
        </SheetContent>
      </Sheet>
      {conferenceSheet}
    </VStack>;
  }

  // Phone (<768): compact floating launcher and dial sheet.
  if (isMobile) {
    return (
      <>
        {!mobileDialOpen && !hideLauncher && <Button ref={launcherRef} className={`${styles.mobileLauncher} ${isRinging ? styles.mobileLauncherRinging : ''} ${isInCall ? styles.mobileLauncherActive : ''} ${className ?? ''}`} style={mobileFloating.style}
          {...mobileFloating.controls('launcher')} data-testid="softphone-widget-sticky"
          aria-label={t('callcenter.softphone.panelTitle')} aria-haspopup="dialog" aria-expanded={mobileDialOpen}
          onClick={event => mobileFloating.activateLauncher(() => setMobileDialOpen(true), event.detail === 0)}>
          <img className={styles.mobileHandset} src={handsetImage} alt="" aria-hidden="true" draggable={false}/>
          <div className={`${styles.stickyDot} ${stickyDotClass}`} />
          {isInCall && <Text className={styles.mobileTimer}>{formatCallTime(callSeconds)}</Text>}
        </Button>}
        <Sheet open={mobileDialOpen} onOpenChange={setMobileDialOpen}>
          <SheetContent className={styles.mobileDialSheet} onCloseAutoFocus={event => { event.preventDefault(); launcherRef.current?.focus(); }}>
            <SheetHeader>
              <SheetTitle>{t('callcenter.softphone.panelTitle')}</SheetTitle>
            </SheetHeader>
            {panelBody}
          </SheetContent>
        </Sheet>
        {conferenceSheet}
      </>
    );
  }

  return (
    <div className={`${styles.chromeWrap} ${floating ? styles.floatingWrap : ''} ${className ?? ''}`} style={floating ? mobileFloating.style : undefined} data-testid="softphone-widget-chrome">
      {open ? (
        <div ref={panelRef} tabIndex={-1} className={styles.chromePanel}
          style={{ ...desktopWindow.style, width: windowWidth }}
          role="region" aria-label={t('callcenter.softphone.panelTitle')} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }} data-testid="softphone-widget-panel">
          <HStack className={styles.windowHeader} gap="8" onPointerDown={event => {
            if (!(event.target as Element).closest('button')) desktopWindow.controls('move').onPointerDown(event);
          }}>
            <Button variant="ghost" size="icon" className={styles.moveHandle}
              aria-label={t('callcenter.softphone.moveWindow')} title={t('callcenter.softphone.moveWindow')}
              {...desktopWindow.controls('move')} data-testid="softphone-window-move"><Grip size={16} aria-hidden /></Button>
            <Text className={styles.panelTitle}>{t('callcenter.softphone.panelTitle')}</Text>
            <Button variant="ghost" size="icon" className={styles.closeWindow}
              aria-label={t('common.close')} title={t('common.close')}
              onClick={() => setOpen(false)} data-testid="softphone-window-close"><X size={18} aria-hidden /></Button>
          </HStack>
          {panelBody}
          <Button variant="ghost" size="none" className={styles.resizeLeft}
            aria-label={t('callcenter.softphone.resizeWindow')} title={t('callcenter.softphone.resizeWindow')}
            {...desktopWindow.controls('resize-left')} data-testid="softphone-window-resize-left" />
          <Button variant="ghost" size="icon" className={styles.resizeWindow}
            aria-label={t('callcenter.softphone.resizeWindow')} title={t('callcenter.softphone.resizeWindow')}
            {...desktopWindow.controls('resize')} data-testid="softphone-window-resize"><MoveDiagonal2 size={16} aria-hidden /></Button>
        </div>
      ) : null}
      {!open && !hideLauncher && <Button
        ref={launcherRef}
        type="button"
        variant="unstyled"
        size="none"
        className={`${floating ? styles.floatingTrigger : styles.chromeTrigger}${showLabel ? ` ${styles.chromeTriggerLabeled}` : ''}${pulseActive ? ` ${styles.chromeTriggerRinging} ${styles.mobileLauncherRinging}` : ''}${isInCall ? ` ${styles.mobileLauncherActive}` : ''}`}
        {...(floating ? mobileFloating.controls('launcher') : {})}
        aria-label={t('callcenter.softphone.panelTitle')}
        aria-expanded={open}
        data-testid="softphone-widget-trigger"
        onClick={event => floating ? mobileFloating.activateLauncher(() => setOpen(true), event.detail === 0) : setOpen((v) => !v)}
      >
        <img className={styles.mobileHandset} src={handsetImage} alt="" aria-hidden="true" draggable={false}/>
        {showLabel ? (
          <span className={styles.chromeTriggerLabel}>
            {t('callcenter.softphone.panelTitle')}
          </span>
        ) : null}
        {!pulseActive ? (
          <span
            className={`${styles.regBadge} ${regBadgeClass}`}
            title={regBadgeLabel}
            aria-label={regBadgeLabel}
            data-testid="softphone-reg-badge"
            data-state={regVisual}
          />
        ) : null}
        {isWebrtc && isInCall && phone.quality ? (
          <span className={styles.qualityCompact} data-testid="softphone-quality-compact">
            <CallQualityIndicator quality={phone.quality} />
          </span>
        ) : null}
      </Button>}
      {conferenceSheet}
    </div>
  );
}
