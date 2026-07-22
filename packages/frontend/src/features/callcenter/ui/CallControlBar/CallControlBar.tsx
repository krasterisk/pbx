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

export type CallControlBarVariant = 'compact' | 'full';

export interface CallControlBarProps {
  /** compact = mute/hold/transfer/hangup only (status bar); full = adds park/conference/warm-transfer/zombie-reset slots (widget). */
  variant?: CallControlBarVariant;
  isMuted: boolean;
  isHeld: boolean;
  /** No active call to control - every action button renders disabled. */
  disabled?: boolean;
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
  const { data: queueList = [] } = useGetQueuesQuery(undefined, { skip: variant !== 'full' });
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
    opts?: { destructive?: boolean; active?: boolean; disabled?: boolean },
  ) => {
    const button = (
      <Button
        key={key}
        type="button"
        variant={opts?.destructive ? 'destructive' : 'outline'}
        size="sm"
        className={`${styles.controlBtn}${opts?.active ? ` ${styles.controlBtnActive}` : ''}`}
        onClick={onClick}
        disabled={disabled || opts?.disabled}
        aria-label={label}
      >
        {icon}
        {!iconOnly && <span className={styles.controlLabel}>{label}</span>}
      </Button>
    );
    return iconOnly ? <Tooltip key={key} content={label}>{button}</Tooltip> : button;
  };

  return (
    <div
      className={`${styles.bar}${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={t('callcenter.controlBar.title', 'Call controls')}
    >
      {renderButton(
        'mute',
        isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />,
        isMuted ? t('callcenter.controlBar.unmute', 'Unmute') : t('callcenter.controlBar.mute', 'Mute'),
        onMuteToggle,
        { active: isMuted },
      )}
      {renderButton(
        'hold',
        isHeld ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />,
        isHeld ? t('callcenter.controlBar.unhold', 'Unhold') : t('callcenter.controlBar.hold', 'Hold'),
        onHoldToggle,
        { active: isHeld },
      )}
      {onTransferClick && renderButton(
        'transfer',
        <PhoneForwarded className="w-4 h-4" />,
        t('callcenter.controlBar.transfer', 'Transfer'),
        onTransferClick,
      )}

      {variant === 'full' && (
        <>
          {renderButton(
            'park',
            <ParkingCircle className="w-4 h-4" />,
            t('callcenter.controlBar.park', 'Park'),
            handlePark,
            { disabled: isParking },
          )}
          {renderButton(
            'conference',
            <Users className="w-4 h-4" />,
            t('callcenter.controlBar.conference', 'Add to conference'),
            onConferenceClick,
          )}

          {(() => {
            const warmTransferLabel = t('callcenter.controlBar.warmTransfer', 'Transfer to queue');
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={disabled || isTransferring || myQueues.length === 0}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={styles.controlBtn}
                    disabled={disabled || isTransferring || myQueues.length === 0}
                    aria-label={warmTransferLabel}
                    title={iconOnly ? warmTransferLabel : undefined}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    {!iconOnly && <span className={styles.controlLabel}>{warmTransferLabel}</span>}
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
            );
          })()}

          {isZombie && renderButton(
            'zombieReset',
            <RotateCcw className="w-4 h-4" />,
            t('callcenter.controlBar.zombieReset', 'Reset call'),
            () => setZombieConfirmOpen(true),
            { destructive: true },
          )}
        </>
      )}

      {renderButton(
        'hangup',
        <PhoneOff className="w-4 h-4" />,
        t('callcenter.controlBar.hangup', 'Hang up'),
        onHangup,
        { destructive: true },
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
