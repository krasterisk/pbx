import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic, MicOff, Pause, Play, Phone, PhoneOff, PhoneForwarded, PhoneIncoming, Users,
} from 'lucide-react';
import {
  Button, Text, HStack, VStack, Popover, PopoverTrigger, PopoverContent,
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/shared/ui';
import { DtmfKeypad } from '@/features/callcenter/ui/DtmfKeypad/DtmfKeypad';
import { TransferDirectory } from '@/features/callcenter/ui/TransferDirectory';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import type { useWebRTCPhone } from '@/features/callcenter/lib/useWebRTCPhone';
import styles from './SoftphoneWidget.module.scss';

export type SoftphonePlacement = 'bottom-right' | 'bottom-left' | 'hidden';

export interface SoftphoneWidgetProps {
  /** Return value of useWebRTCPhone - this widget only renders it, never forks call logic. */
  phone: ReturnType<typeof useWebRTCPhone>;
  callerName?: string;
  queueLabel?: string;
  /** Elapsed call seconds, owned by the page orchestrator's timer. */
  callSeconds?: number;
  placement?: SoftphonePlacement;
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
  visible = true,
  onTransferClick,
  onOpenCard,
  extraControls,
  activeCallUniqueid,
}: SoftphoneWidgetProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile(768);
  const [open, setOpen] = useState(false);
  const [conferenceOpen, setConferenceOpen] = useState(false);

  const isRinging = phone.status === 'ringing';
  const isInCall = phone.status === 'in-call';
  const callerLabel = callerName || phone.callInfo?.from || t('callcenter.noActiveCall');

  const handleDigit = useCallback((digit: string) => {
    void phone.sendDtmf(digit);
  }, [phone]);

  const handleHoldToggle = useCallback(() => {
    if (phone.isHeld) void phone.unhold();
    else void phone.hold();
  }, [phone]);

  const handleMuteToggle = useCallback(() => {
    if (phone.isMuted) phone.unmute();
    else phone.mute();
  }, [phone]);

  if (placement === 'hidden' || !visible) return null;

  const controlsRow = (
    <div className={styles.controlsRow}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleMuteToggle}
        disabled={!isInCall}
        aria-label={phone.isMuted ? t('callcenter.softphone.unmute') : t('callcenter.softphone.mute')}
      >
        {phone.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleHoldToggle}
        disabled={!isInCall}
        aria-label={phone.isHeld ? t('callcenter.softphone.unhold') : t('callcenter.softphone.hold')}
      >
        {phone.isHeld ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      </Button>
      <DtmfKeypad onDigit={handleDigit} disabled={!isInCall} />
      {onTransferClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onTransferClick}
          disabled={!isInCall}
          aria-label={t('callcenter.softphone.transfer')}
        >
          <PhoneForwarded className="w-4 h-4" />
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConferenceOpen(true)}
        disabled={!isInCall || !activeCallUniqueid}
        aria-label={t('callcenter.controlBar.conference', 'Add to conference')}
      >
        <Users className="w-4 h-4" />
      </Button>
      {extraControls}
      <Button
        variant="destructive"
        size="sm"
        onClick={() => void phone.hangup()}
        disabled={!isInCall}
        aria-label={t('callcenter.softphone.hangup')}
      >
        <PhoneOff className="w-4 h-4" />
      </Button>
    </div>
  );

  const ringingActions = isRinging ? (
    <HStack gap="8" className={styles.ringingActions}>
      <Button size="lg" onClick={() => void phone.acceptCall()}>
        <Phone className="w-4 h-4 mr-1" />
        {t('callcenter.softphone.answer')}
      </Button>
      <Button variant="destructive" size="lg" onClick={() => void phone.rejectCall()}>
        <PhoneOff className="w-4 h-4 mr-1" />
        {t('callcenter.softphone.reject')}
      </Button>
    </HStack>
  ) : null;

  const panelBody = (
    <VStack gap="12" className={styles.panelBody}>
      <Text className={styles.panelTitle}>{t('callcenter.softphone.panelTitle')}</Text>
      {isInCall || isRinging ? (
        <VStack gap="4" align="center" className={styles.callSummary}>
          <Text className={styles.callTimerDisplay}>{formatCallTime(callSeconds)}</Text>
          <Text className={styles.callerNumber}>{callerLabel}</Text>
          {queueLabel ? <span className={styles.queueTag}>{queueLabel}</span> : null}
        </VStack>
      ) : (
        <Text variant="muted" className="text-sm">{t('callcenter.noActiveCall')}</Text>
      )}
      {ringingActions}
      {isInCall ? controlsRow : null}
      {isInCall && onOpenCard ? (
        <Button variant="outline" size="sm" onClick={onOpenCard}>
          {t('callcenter.cards.popup.openManual')}
        </Button>
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

  // Phone (<768): no free-floating FAB — controls surface through the sticky bar (D-46).
  if (isMobile) {
    return (
      <>
        <div className={styles.stickyBar} data-testid="softphone-widget-sticky">
          <div
            className={`${styles.stickyDot} ${
              isRinging ? styles.stickyDotRinging : isInCall ? styles.stickyDotInCall : styles.stickyDotIdle
            }`}
          />
          <VStack gap="0" className={styles.stickyInfo}>
            <Text className={styles.stickyCaller}>
              {isInCall || isRinging ? callerLabel : t('callcenter.noActiveCall')}
            </Text>
            {isInCall || isRinging ? (
              <Text className={styles.stickyTimer}>{formatCallTime(callSeconds)}</Text>
            ) : null}
          </VStack>
          {isRinging ? ringingActions : isInCall ? controlsRow : null}
        </div>
        {conferenceSheet}
      </>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`${styles.fab} ${placement === 'bottom-left' ? styles.fabLeft : styles.fabRight} ${
              isRinging ? styles.fabRinging : ''
            }`}
            aria-label={t('callcenter.softphone.panelTitle')}
            data-testid="softphone-widget-fab"
          >
            {isRinging ? <PhoneIncoming className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={placement === 'bottom-left' ? 'start' : 'end'}
          side="top"
          sideOffset={12}
          style={{ width: 320 }}
          className={styles.panel}
        >
          {panelBody}
        </PopoverContent>
      </Popover>
      {conferenceSheet}
    </>
  );
}
