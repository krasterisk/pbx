import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mic, MicOff, Pause, Play, PhoneForwarded, PhoneOff,
  ParkingCircle, Users, RotateCcw, ArrowLeftRight,
} from 'lucide-react';
import { Button, Tooltip } from '@/shared/ui';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
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
  /** Full variant only - real handlers land in 09-10; labelled placeholders wired to no-op until then. */
  onParkClick?: () => void;
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
  onParkClick = noop,
  onConferenceClick = noop,
  onWarmTransferClick = noop,
  onZombieResetClick = noop,
  className,
}: CallControlBarProps) {
  const { t } = useTranslation();
  // Icon+label >=768px, icon-only+tooltip <768px, per UI-SPEC Surface 1.
  const iconOnly = useIsMobile(768);

  const renderButton = (
    key: string,
    icon: ReactNode,
    label: string,
    onClick: () => void,
    opts?: { destructive?: boolean; active?: boolean },
  ) => {
    const button = (
      <Button
        key={key}
        type="button"
        variant={opts?.destructive ? 'destructive' : 'outline'}
        size="sm"
        className={`${styles.controlBtn}${opts?.active ? ` ${styles.controlBtnActive}` : ''}`}
        onClick={onClick}
        disabled={disabled}
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
            onParkClick,
          )}
          {renderButton(
            'conference',
            <Users className="w-4 h-4" />,
            t('callcenter.controlBar.conference', 'Add to conference'),
            onConferenceClick,
          )}
          {renderButton(
            'warmTransfer',
            <ArrowLeftRight className="w-4 h-4" />,
            t('callcenter.controlBar.warmTransfer', 'Transfer to queue'),
            onWarmTransferClick,
          )}
          {renderButton(
            'zombieReset',
            <RotateCcw className="w-4 h-4" />,
            t('callcenter.controlBar.zombieReset', 'Reset call'),
            onZombieResetClick,
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
    </div>
  );
}
