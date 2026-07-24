import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic, MicOff, Pause, Play, Phone, PhoneOff, PhoneForwarded, PhoneIncoming, Users,
  BookUser, History,
} from 'lucide-react';
import {
  Button, Text, HStack, VStack, Tooltip,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/shared/ui';
import { DialpadGrid, DIALPAD_KEYS } from '@/features/callcenter/ui/DtmfKeypad/DialpadGrid';
import { DtmfKeypad } from '@/features/callcenter/ui/DtmfKeypad/DtmfKeypad';
import { TransferDirectory } from '@/features/callcenter/ui/TransferDirectory';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { useWebRTCPhone } from '@/features/callcenter/lib/useWebRTCPhone';
import styles from './SoftphoneWidget.module.scss';

export type SoftphonePlacement = 'bottom-right' | 'bottom-left' | 'hidden';
export type SoftphoneVariant = 'fab' | 'chrome';
type SoftphoneTab = 'dial' | 'journal' | 'contacts';

export interface SoftphoneWidgetProps {
  /** Return value of useWebRTCPhone - this widget only renders it, never forks call logic. */
  phone: ReturnType<typeof useWebRTCPhone>;
  callerName?: string;
  queueLabel?: string;
  /** Elapsed call seconds, owned by the page orchestrator's timer. */
  callSeconds?: number;
  /** @deprecated FAB corner placement — prefer variant="chrome" docked in the status bar. */
  placement?: SoftphonePlacement;
  /** fab = floating corner button; chrome = inline header/status trigger. */
  variant?: SoftphoneVariant;
  /** Show text label next to the chrome trigger (e.g. "Softphone"). */
  showLabel?: boolean;
  visible?: boolean;
  onTransferClick?: () => void;
  onOpenCard?: () => void;
  /** Slot for park/zombie-reset controls (09-10's remaining CallControlBar full-variant actions). */
  extraControls?: ReactNode;
  /**
   * uniqueid of the operator's own active call — required for the built-in
   * "Add to conference" control (D-28, 09-10→09-12 key link). Omit/undefined
   * degrades the control to disabled (no active call, nothing to conference).
   */
  activeCallUniqueid?: string;
  /**
   * Outbound target requested by click-to-call / history (WebRTC mode).
   * Softphone consumes and dials, then calls onOutboundDialConsumed.
   */
  pendingOutboundDial?: string | null;
  onOutboundDialConsumed?: () => void;
}

function formatCallTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SoftphoneWidget({
  phone,
  callerName,
  queueLabel,
  callSeconds = 0,
  placement = 'bottom-right',
  variant = 'fab',
  showLabel = false,
  visible = true,
  onTransferClick,
  onOpenCard,
  extraControls,
  activeCallUniqueid,
  pendingOutboundDial,
  onOutboundDialConsumed,
}: SoftphoneWidgetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const [open, setOpen] = useState(false);
  const [mobileDialOpen, setMobileDialOpen] = useState(false);
  const [conferenceOpen, setConferenceOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [dialError, setDialError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SoftphoneTab>('dial');
  const isChrome = variant === 'chrome';

  const isRinging = phone.status === 'ringing';
  const isDialing = phone.status === 'dialing';
  const isInCall = phone.status === 'in-call';
  const isIdle =
    phone.status === 'registered'
    || phone.status === 'connecting'
    || phone.status === 'disconnected';
  const canDial = phone.status === 'registered';

  const callerLabel =
    callerName
    || phone.callInfo?.from
    || phone.callInfo?.to
    || t('callcenter.noActiveCall');

  // Auto-expand only for outbound dialing (already interacting with softphone).
  // Incoming ring: toast only — softphone opens manually (avoids duplicate UI).
  useEffect(() => {
    if (isDialing) {
      setOpen(true);
      setActiveTab('dial');
      if (isMobile) setMobileDialOpen(true);
    }
  }, [isDialing, isMobile]);

  // Click-to-call / history → WebRTC INVITE bridge
  useEffect(() => {
    if (!pendingOutboundDial || !canDial) return;
    const target = pendingOutboundDial;
    onOutboundDialConsumed?.();
    setDialNumber(target);
    setDialError(null);
    setOpen(true);
    if (isMobile) setMobileDialOpen(true);
    void phone.makeCall(target).catch(() => {
      setDialError(t('callcenter.softphone.dialFailed', 'Could not place call'));
    });
  }, [pendingOutboundDial, canDial, phone, onOutboundDialConsumed, t, isMobile]);

  // Hardware keyboard → dial buffer while idle / DTMF while in-call
  useEffect(() => {
    if (!open && !mobileDialOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
        void phone.makeCall(target).catch(() => {
          setDialError(t('callcenter.softphone.dialFailed', 'Could not place call'));
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, mobileDialOpen, isInCall, isIdle, canDial, dialNumber, phone, t]);

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

  const handleDial = useCallback(async () => {
    const target = dialNumber.trim();
    if (!target || !canDial) return;
    setDialError(null);
    try {
      await phone.makeCall(target);
    } catch {
      setDialError(t('callcenter.softphone.dialFailed', 'Could not place call'));
    }
  }, [dialNumber, canDial, phone, t]);

  const handleHoldToggle = useCallback(() => {
    if (phone.isHeld) void phone.unhold();
    else void phone.hold();
  }, [phone]);

  const handleMuteToggle = useCallback(() => {
    if (phone.isMuted) phone.unmute();
    else phone.mute();
  }, [phone]);

  if ((placement === 'hidden' && !isChrome) || !visible) return null;

  const controlsRow = (
    <div className={styles.controlsRow}>
      <Tooltip content={phone.isMuted
        ? t('callcenter.controlBar.unmute', 'Unmute')
        : t('callcenter.controlBar.muteHint', 'Mute or unmute your microphone')}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleMuteToggle}
          disabled={!isInCall}
          aria-label={phone.isMuted ? t('callcenter.softphone.unmute') : t('callcenter.softphone.mute')}
        >
          {phone.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      </Tooltip>
      <Tooltip content={phone.isHeld
        ? t('callcenter.controlBar.unhold', 'Unhold')
        : t('callcenter.controlBar.holdHint', 'Put the caller on hold or resume')}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleHoldToggle}
          disabled={!isInCall}
          aria-label={phone.isHeld ? t('callcenter.softphone.unhold') : t('callcenter.softphone.hold')}
        >
          {phone.isHeld ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
      </Tooltip>
      <DtmfKeypad onDigit={handleDigit} disabled={!isInCall} />
      {onTransferClick && (
        <Tooltip content={t('callcenter.controlBar.transferHint', 'Open transfer panel')}>
          <Button
            variant="outline"
            size="sm"
            onClick={onTransferClick}
            disabled={!isInCall}
            aria-label={t('callcenter.softphone.transfer')}
          >
            <PhoneForwarded className="w-4 h-4" />
          </Button>
        </Tooltip>
      )}
      <Tooltip content={t('callcenter.controlBar.conferenceHint', 'Add another party to this call')}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConferenceOpen(true)}
          disabled={!isInCall || !activeCallUniqueid}
          aria-label={t('callcenter.controlBar.conference', 'Add to conference')}
        >
          <Users className="w-4 h-4" />
        </Button>
      </Tooltip>
      {extraControls}
      <Tooltip content={t('callcenter.controlBar.hangupHint', 'End the active call')}>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => void phone.hangup()}
          disabled={!isInCall && !isDialing}
          aria-label={t('callcenter.softphone.hangup')}
        >
          <PhoneOff className="w-4 h-4" />
        </Button>
      </Tooltip>
    </div>
  );

  const ringingActions = isRinging ? (
    <div className={styles.ringingActions}>
      <Button size="lg" className={styles.ringingBtn} onClick={() => void phone.acceptCall()}>
        <Phone className="w-4 h-4 mr-1" />
        {t('callcenter.softphone.answer')}
      </Button>
      <Button variant="destructive" size="lg" className={styles.ringingBtn} onClick={() => void phone.rejectCall()}>
        <PhoneOff className="w-4 h-4 mr-1" />
        {t('callcenter.softphone.reject')}
      </Button>
    </div>
  ) : null;

  const dialPadBlock = (
    <VStack gap="8" className={styles.dialBlock} data-testid="softphone-dialpad">
      <div className={styles.dialDisplay}>
        <input
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
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackspace}
          disabled={!dialNumber || !canDial}
          aria-label={t('callcenter.softphone.backspace', 'Backspace')}
        >
          <span aria-hidden>⌫</span>
        </Button>
      </div>
      <DialpadGrid onDigit={handleDigit} disabled={!canDial} className={styles.dialGrid} />
      {dialError ? <Text variant="muted" className={styles.dialError}>{dialError}</Text> : null}
      <Button
        size="lg"
        className={styles.dialCallBtn}
        onClick={() => void handleDial()}
        disabled={!canDial || !dialNumber.trim()}
      >
        <Phone className="w-4 h-4 mr-1" />
        {t('callcenter.softphone.dial', 'Call')}
      </Button>
      {!canDial && phone.status === 'connecting' ? (
        <Text variant="muted" className="text-xs text-center">
          {t('callcenter.softphone.connecting')}
        </Text>
      ) : null}
    </VStack>
  );

  const panelBody = (
    <VStack gap="12" className={styles.panelBody}>
      <Text className={styles.panelTitle}>{t('callcenter.softphone.panelTitle')}</Text>
      <div className={styles.tabRow} role="tablist" aria-label={t('callcenter.softphone.tabsLabel', 'Softphone sections')}>
        {([
          { id: 'dial' as const, icon: Phone, label: t('callcenter.softphone.tabDial', 'Dial') },
          { id: 'journal' as const, icon: History, label: t('callcenter.softphone.tabJournal', 'Journal') },
          { id: 'contacts' as const, icon: BookUser, label: t('callcenter.softphone.tabContacts', 'Contacts') },
        ]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={`${styles.tabBtn}${activeTab === id ? ` ${styles.tabBtnActive}` : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'journal' ? (
        <Text variant="muted" className={styles.tabPlaceholder}>
          {t('callcenter.softphone.journalSoon', 'Call journal will land in the full softphone phase.')}
        </Text>
      ) : null}

      {activeTab === 'contacts' ? (
        <Text variant="muted" className={styles.tabPlaceholder}>
          {t('callcenter.softphone.contactsSoon', 'Endpoints, queues and groups: full softphone phase.')}
        </Text>
      ) : null}

      {activeTab === 'dial' ? (
        <>
          {isInCall || isRinging || isDialing ? (
            <VStack gap="4" align="center" className={styles.callSummary}>
              <Text className={styles.callTimerDisplay}>
                {isDialing
                  ? t('callcenter.softphone.calling', 'Calling…')
                  : formatCallTime(callSeconds)}
              </Text>
              <Text className={styles.callerNumber}>{callerLabel}</Text>
              {queueLabel && !isDialing ? <span className={styles.queueTag}>{queueLabel}</span> : null}
            </VStack>
          ) : (
            dialPadBlock
          )}
          {ringingActions}
          {isDialing ? (
            <Button variant="destructive" size="lg" onClick={() => void phone.hangup()}>
              <PhoneOff className="w-4 h-4 mr-1" />
              {t('callcenter.softphone.cancelDial', 'Cancel')}
            </Button>
          ) : null}
          {isInCall ? controlsRow : null}
          {isInCall && onOpenCard ? (
            <Button variant="outline" size="sm" onClick={onOpenCard}>
              {t('callcenter.cards.popup.openManual')}
            </Button>
          ) : null}
        </>
      ) : null}
    </VStack>
  );

  const conferenceSheet = (
    <Sheet open={conferenceOpen} onOpenChange={setConferenceOpen}>
      <SheetContent className={styles.conferenceSheet}>
        <SheetHeader>
          <SheetTitle>{t('callcenter.controlBar.conference', 'Add to conference')}</SheetTitle>
        </SheetHeader>
        <TransferDirectory
          mode="conference-add"
          activeCallUniqueid={activeCallUniqueid}
          onDone={() => setConferenceOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );

  // Phone (<768): sticky bar + dial sheet (D-01/D-46)
  if (isMobile) {
    return (
      <>
        <div className={styles.stickyBar} data-testid="softphone-widget-sticky">
          <div
            className={`${styles.stickyDot} ${
              isRinging || isDialing
                ? styles.stickyDotRinging
                : isInCall
                  ? styles.stickyDotInCall
                  : styles.stickyDotIdle
            }`}
          />
          <VStack gap="0" className={styles.stickyInfo}>
            <Text className={styles.stickyCaller}>
              {isInCall || isRinging || isDialing
                ? callerLabel
                : t('callcenter.softphone.panelTitle')}
            </Text>
            {isInCall || isRinging ? (
              <Text className={styles.stickyTimer}>{formatCallTime(callSeconds)}</Text>
            ) : isDialing ? (
              <Text className={styles.stickyTimer}>{t('callcenter.softphone.calling', 'Calling…')}</Text>
            ) : null}
          </VStack>
          {isRinging ? ringingActions : null}
          {isDialing ? (
            <Button variant="destructive" size="sm" onClick={() => void phone.hangup()}>
              <PhoneOff className="w-4 h-4" />
            </Button>
          ) : null}
          {isInCall ? controlsRow : null}
          {isIdle ? (
            <Button size="sm" onClick={() => setMobileDialOpen(true)} disabled={!canDial}>
              <Phone className="w-4 h-4 mr-1" />
              {t('callcenter.softphone.dial', 'Call')}
            </Button>
          ) : null}
        </div>
        <Sheet open={mobileDialOpen} onOpenChange={setMobileDialOpen}>
          <SheetContent className={styles.mobileDialSheet}>
            <SheetHeader>
              <SheetTitle>{t('callcenter.softphone.panelTitle')}</SheetTitle>
            </SheetHeader>
            {isIdle ? dialPadBlock : panelBody}
          </SheetContent>
        </Sheet>
        {conferenceSheet}
      </>
    );
  }

  if (isChrome) {
    return (
      <div className={styles.chromeWrap} data-testid="softphone-widget-chrome">
        {open ? (
          <div className={styles.chromePanel} data-testid="softphone-widget-panel">
            {panelBody}
            <Button
              variant="ghost"
              size="sm"
              className={styles.collapseBtn}
              onClick={() => setOpen(false)}
            >
              {t('callcenter.softphone.collapse', 'Minimize')}
            </Button>
          </div>
        ) : null}
        <button
          type="button"
          className={`${styles.chromeTrigger}${showLabel ? ` ${styles.chromeTriggerLabeled}` : ''}${isRinging || isDialing ? ` ${styles.chromeTriggerRinging}` : ''}${open ? ` ${styles.chromeTriggerOpen}` : ''}`}
          aria-label={t('callcenter.softphone.panelTitle')}
          aria-expanded={open}
          data-testid="softphone-widget-fab"
          onClick={() => setOpen((v) => !v)}
        >
          {isRinging || isDialing
            ? <PhoneIncoming className="w-5 h-5" />
            : <Phone className="w-5 h-5" />}
          {showLabel ? (
            <span className={styles.chromeTriggerLabel}>
              {t('callcenter.softphone.panelTitle')}
            </span>
          ) : null}
        </button>
        {conferenceSheet}
      </div>
    );
  }

  return (
    <>
      <div
        className={`${styles.fabWrap} ${placement === 'bottom-left' ? styles.fabLeft : styles.fabRight}`}
      >
        {open ? (
          <div className={styles.panel} data-testid="softphone-widget-panel">
            {panelBody}
            <Button
              variant="ghost"
              size="sm"
              className={styles.collapseBtn}
              onClick={() => setOpen(false)}
            >
              {t('callcenter.softphone.collapse', 'Minimize')}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className={`${styles.fab} ${isRinging || isDialing ? styles.fabRinging : ''}`}
            aria-label={t('callcenter.softphone.panelTitle')}
            data-testid="softphone-widget-fab"
            onClick={() => setOpen(true)}
          >
            {isRinging || isDialing
              ? <PhoneIncoming className="w-6 h-6" />
              : <Phone className="w-6 h-6" />}
          </button>
        )}
      </div>
      {conferenceSheet}
    </>
  );
}
