import { useState, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Mic, MicOff, Pause, Play, PhoneForwarded, PhoneOff,
  ParkingCircle, Users, RotateCcw, ArrowLeftRight,
} from 'lucide-react';
import {
  Button, Tooltip,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Text,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
  useParkCallMutation,
  useWarmTransferToQueueMutation,
  useResetZombieCallMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { selectMyAgent, selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import styles from './CallControlBar.module.scss';

export type CallControlBarVariant = 'compact' | 'full' | 'extended';

export interface CallControlBarProps {
  /** compact = mute/hold/transfer/hangup (status bar); full = primary + park/conference/warm/zombie; extended = park/warm/zombie only (softphone slot). */
  variant?: CallControlBarVariant;
  isMuted: boolean;
  isHeld: boolean;
  /** No active call to control - every action button renders disabled. */
  disabled?: boolean;
  /** SIP desk-phone mode: Hold is client-side only — keep the button visible but inactive. */
  holdDisabled?: boolean;
  onMuteToggle: () => void;
  onHoldToggle: () => void;
  onHangup: () => void;
  /** Omit to hide the Transfer button entirely (host has no transfer target yet). */
  onTransferClick?: () => void;
  /** Full variant only - uniqueid of the operator's own active call, required for park/warm-transfer/zombie-reset. */
  uniqueid?: string;
  /** Full variant only - render the zombie-reset button only when the active call is flagged as stuck (D-27). */
  isZombie?: boolean;
  /** Full variant only. Park/warm-transfer/zombie-reset call their own RTK mutations internally
   * (see uniqueid) - these fire in addition, e.g. for host-side toast/analytics. */
  onParkClick?: () => void;
  /** Add-to-conference opens the transfer-directory in "add" mode (ships in 09-12) - host-provided
   * until then; the button degrades to a no-op without it. */
  onConferenceClick?: () => void;
  onWarmTransferClick?: () => void;
  onZombieResetClick?: () => void;
  className?: string;
}

const noop = () => {};

export function CallControlBar({
  variant = 'compact',
  isMuted,
  isHeld,
  disabled = false,
  holdDisabled = false,
  onMuteToggle,
  onHoldToggle,
  onHangup,
  onTransferClick,
  uniqueid,
  isZombie = false,
  onParkClick = noop,
  onConferenceClick = noop,
  onWarmTransferClick = noop,
  onZombieResetClick = noop,
  className,
}: CallControlBarProps) {
  const { t } = useTranslation();
  // Icon+label >=768px, icon-only+tooltip <768px, per UI-SPEC Surface 1.
  const iconOnly = useIsMobile(768);

  const [parkCall, { isLoading: isParking }] = useParkCallMutation();
  const [warmTransferToQueue, { isLoading: isTransferring }] = useWarmTransferToQueueMutation();
  const [resetZombieCall, { isLoading: isResetting }] = useResetZombieCallMutation();
  const [zombieConfirmOpen, setZombieConfirmOpen] = useState(false);

  const myAgent = useSelector(selectMyAgent);
  const ccQueues = useSelector(selectCcQueues);
  const { data: queueList = [] } = useGetQueuesQuery(undefined, { skip: variant === 'compact' });
  const queueLabelSources = [
    ...ccQueues.map((q) => ({ name: q.name, displayName: q.displayName })),
    ...queueList.map((q) => ({
      name: q.name,
      displayName: q.display_name || q.name,
      exten: q.exten,
    })),
  ];
  const myQueues = myAgent?.queues ?? [];

  const handlePark = async () => {
    if (uniqueid) {
      try {
        await parkCall({ uniqueid }).unwrap();
      } catch (err: any) {
        console.warn('Park failed:', err?.data?.message || err?.message);
        return;
      }
    }
    onParkClick();
  };

  const handleWarmTransfer = async (queue: string) => {
    if (uniqueid) {
      try {
        await warmTransferToQueue({ uniqueid, queue }).unwrap();
      } catch (err: any) {
        console.warn('Warm transfer failed:', err?.data?.message || err?.message);
        return;
      }
    }
    onWarmTransferClick();
  };

  const handleZombieReset = async () => {
    if (uniqueid) {
      try {
        await resetZombieCall({ uniqueid }).unwrap();
      } catch (err: any) {
        console.warn('Zombie reset failed:', err?.data?.message || err?.message);
      }
    }
    setZombieConfirmOpen(false);
    onZombieResetClick();
  };

  const renderButton = (
    key: string,
    icon: ReactNode,
    label: string,
    onClick: () => void,
    opts?: { destructive?: boolean; active?: boolean; disabled?: boolean; hint?: string },
  ) => {
    const isBtnDisabled = disabled || !!opts?.disabled;
    const button = (
      <Button
        key={key}
        type="button"
        variant={opts?.destructive ? 'destructive' : 'outline'}
        size="sm"
        className={`${styles.controlBtn}${opts?.active ? ` ${styles.controlBtnActive}` : ''}`}
        onClick={onClick}
        disabled={isBtnDisabled}
        aria-label={label}
      >
        {icon}
        {!iconOnly && variant !== 'extended' && <span className={styles.controlLabel}>{label}</span>}
      </Button>
    );
    return (
      <Tooltip key={key} content={opts?.hint || label}>
        {/* Disabled buttons don't fire pointer events — wrap so the hint still shows. */}
        {isBtnDisabled ? <span className="inline-flex">{button}</span> : button}
      </Tooltip>
    );
  };

  const showPrimary = variant === 'compact' || variant === 'full';
  const showExtended = variant === 'full' || variant === 'extended';

  return (
    <div
      className={`${styles.bar}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={t('callcenter.controlBar.title', 'Call controls')}
    >
      {showPrimary && renderButton(
        'mute',
        isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />,
        isMuted ? t('callcenter.controlBar.unmute', 'Unmute') : t('callcenter.controlBar.mute', 'Mute'),
        onMuteToggle,
        {
          active: isMuted,
          hint: t('callcenter.controlBar.muteHint', 'Mute or unmute your microphone'),
        },
      )}
      {showPrimary && renderButton(
        'hold',
        isHeld ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />,
        isHeld ? t('callcenter.controlBar.unhold', 'Unhold') : t('callcenter.controlBar.hold', 'Hold'),
        onHoldToggle,
        {
          active: isHeld && !holdDisabled,
          disabled: holdDisabled,
          hint: holdDisabled
            ? t(
              'callcenter.controlBar.holdUseDeviceHint',
              'Use the Hold button on your SIP phone or softphone client',
            )
            : t('callcenter.controlBar.holdHint', 'Put the caller on hold or resume'),
        },
      )}
      {showPrimary && onTransferClick && renderButton(
        'transfer',
        <PhoneForwarded className="w-4 h-4" />,
        t('callcenter.controlBar.transfer', 'Transfer'),
        onTransferClick,
        { hint: t('callcenter.controlBar.transferHint', 'Open transfer panel') },
      )}

      {showExtended && (
        <>
          {renderButton(
            'park',
            <ParkingCircle className="w-4 h-4" />,
            t('callcenter.controlBar.park', 'Park'),
            handlePark,
            {
              disabled: isParking,
              hint: t('callcenter.controlBar.parkHint', 'Park the call so another agent can pick it up'),
            },
          )}
          {variant === 'full' && renderButton(
            'conference',
            <Users className="w-4 h-4" />,
            t('callcenter.controlBar.conference', 'Add to conference'),
            onConferenceClick,
            { hint: t('callcenter.controlBar.conferenceHint', 'Add another party to this call') },
          )}

          {(() => {
            const warmTransferLabel = t('callcenter.controlBar.warmTransfer', 'Transfer to queue');
            const warmHint = t('callcenter.controlBar.warmTransferHint', 'Send the caller into one of your queues');
            return (
              <Tooltip content={warmHint}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={disabled || isTransferring || myQueues.length === 0}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={styles.controlBtn}
                      disabled={disabled || isTransferring || myQueues.length === 0}
                      aria-label={warmTransferLabel}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      {!iconOnly && variant !== 'extended' && (
                        <span className={styles.controlLabel}>{warmTransferLabel}</span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {myQueues.map((q) => (
                      <DropdownMenuItem key={q} onClick={() => handleWarmTransfer(q)}>
                        {queueDisplayName(q, queueLabelSources) || q}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </Tooltip>
            );
          })()}

          {isZombie && renderButton(
            'zombieReset',
            <RotateCcw className="w-4 h-4" />,
            t('callcenter.controlBar.zombieReset', 'Reset call'),
            () => setZombieConfirmOpen(true),
            {
              destructive: true,
              hint: t('callcenter.controlBar.zombieResetHint', 'Force-clear a stuck call channel'),
            },
          )}
        </>
      )}

      {showPrimary && renderButton(
        'hangup',
        <PhoneOff className="w-4 h-4" />,
        t('callcenter.controlBar.hangup', 'Hang up'),
        onHangup,
        {
          destructive: true,
          hint: t('callcenter.controlBar.hangupHint', 'End the active call'),
        },
      )}

      <Dialog open={zombieConfirmOpen} onOpenChange={setZombieConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('callcenter.controlBar.zombieResetConfirmTitle', 'Reset stuck call?')}</DialogTitle>
          </DialogHeader>
          <Text variant="muted" className="text-sm">
            {t(
              'callcenter.controlBar.zombieResetConfirmBody',
              'Reset stuck call: the channel will be forcibly terminated. Continue?',
            )}
          </Text>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setZombieConfirmOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleZombieReset} disabled={isResetting}>
              {t('callcenter.controlBar.zombieReset', 'Reset call')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
