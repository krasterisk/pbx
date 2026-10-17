import { memo } from 'react';
import { clsx } from 'clsx';
import { Text } from '@/shared/ui';
import type { ICall } from '../../model/types/callCenterSchema';
import { callTalkSec, callWaitSec, formatClock, isActiveCall, isPendingCall } from '../../lib/liveCallTiming';
import { useNowTick } from '../../lib/useNowTick';
import styles from './LiveDuration.module.scss';

export interface LiveDurationProps {
  call: ICall;
  /** `wait` ticks while the caller is pending; `talk` ticks during a conversation. */
  kind: 'wait' | 'talk';
  /** Highlight once the duration exceeds this many seconds (0 / undefined = never). */
  limitSec?: number;
}

/**
 * Ticking per-call duration. Owns its own clock subscription, so only this cell re-renders each
 * second, never the table around it.
 */
export const LiveDuration = memo(function LiveDuration({ call, kind, limitSec }: LiveDurationProps) {
  const ticking = kind === 'wait' ? isPendingCall(call) : isActiveCall(call);
  const now = useNowTick(ticking);
  const sec = kind === 'wait' ? callWaitSec(call, now) : callTalkSec(call, now);
  const over = (limitSec ?? 0) > 0 && sec > (limitSec as number);
  const visible = ticking || sec > 0;

  return (
    <Text
      as="span"
      variant="small"
      className={clsx(styles.value, over && styles.over, !visible && styles.empty)}
      data-testid={`live-${kind}-${call.uniqueid}`}
      data-over={over ? 'true' : 'false'}
    >
      {visible ? formatClock(sec) : '—'}
    </Text>
  );
});
