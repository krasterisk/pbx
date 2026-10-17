import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Eye, Headphones, Megaphone, MessageSquare, PhoneOff } from 'lucide-react';
import { Button, Flex, HStack, SegmentedControl, Text } from '@/shared/ui';
import type { RootState } from '@/app/store/store';
import {
  useSupervisorSpyModeMutation,
  useSupervisorSpyStopMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { setMonitorSession } from '../../model/slice/callCenterSlice';
import { subscribeStatusClock } from '../../lib/statusClock';
import { formatCcDuration } from '../../lib/ccFormat';
import styles from './MonitorSessionBar.module.scss';

export type MonitorMode = 'spy' | 'whisper' | 'barge';

/**
 * Sticky supervisor ChanSpy session bar (U1.5).
 * Shows who the supervisor is listening to, live elapsed time, device ring hint,
 * DTMF mode switcher (spy / whisper / barge without redialing), and Stop button.
 */
export function MonitorSessionBar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const session = useSelector((s: RootState) => s.callCenter?.monitorSession ?? null);
  const [spyMode, { isLoading: switching }] = useSupervisorSpyModeMutation();
  const [spyStop, { isLoading: stopping }] = useSupervisorSpyStopMutation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [actionError, setActionError] = useState(false);
  const currentSession = useRef(session);
  currentSession.current = session;

  useEffect(() => {
    if (!session) return;
    setNowMs(Date.now());
    return subscribeStatusClock(() => setNowMs(Date.now()));
  }, [session]);

  if (!session) return null;

  const startedMs = Date.parse(session.startedAt);
  const elapsedSec = Number.isFinite(startedMs) ? Math.max(0, Math.floor((nowMs - startedMs) / 1000)) : 0;

  const handleModeChange = async (nextMode: MonitorMode) => {
    if (nextMode === session.mode || !session.connected) return;
    setActionError(false);
    try {
      await spyMode({ mode: nextMode }).unwrap();
      if (currentSession.current?.sessionId === session.sessionId) {
        dispatch(setMonitorSession({ ...currentSession.current, mode: nextMode }));
      }
    } catch {
      setActionError(true);
    }
  };

  const handleStop = async () => {
    setActionError(false);
    try {
      await spyStop().unwrap();
      if (currentSession.current?.sessionId === session.sessionId) dispatch(setMonitorSession(null));
    } catch {
      setActionError(true);
    }
  };

  return (
    <Flex
      align="center"
      justify="between"
      gap="12"
      wrap="wrap"
      role="status"
      className={styles.bar}
      data-testid="cc-monitor-session-bar"
    >
      <HStack gap="8" align="center" wrap="wrap">
        <Headphones size={16} className={styles.icon} aria-hidden="true" />
        <Text as="span" variant="small">
          {t('callcenter.supervisor.monitorBar.listening', {
            defaultValue: 'Monitoring: {{agent}}',
            agent: session.agentName,
          })}
        </Text>
        <Text as="span" variant="small" className={styles.timer} data-testid="cc-monitor-session-timer">
          {formatCcDuration(elapsedSec)}
        </Text>
        <Text as="span" variant="xs">
          {session.connected ? t('callcenter.supervisor.monitorBar.connected') : t('callcenter.supervisor.monitorBar.deviceHint', 'Your phone will ring to connect the audio leg')}
        </Text>
      </HStack>

      {actionError && <Text role="alert">{t('callcenter.supervisor.monitorBar.actionFailed')}</Text>}

      <HStack gap="8" align="center" wrap="wrap">
        <SegmentedControl<MonitorMode>
          value={session.mode}
          onChange={(m) => void handleModeChange(m)}
          ariaLabel={t('callcenter.supervisor.monitorBar.modeLabel', 'Monitor mode')}
          options={[
            {
              value: 'spy',
              icon: Eye,
              label: t('callcenter.supervisor.spy', 'Spy'),
              disabled: switching || stopping || !session.connected,
            },
            {
              value: 'whisper',
              icon: MessageSquare,
              label: t('callcenter.supervisor.whisper', 'Whisper'),
              disabled: switching || stopping || !session.connected,
            },
            {
              value: 'barge',
              icon: Megaphone,
              label: t('callcenter.supervisor.barge', 'Barge'),
              disabled: switching || stopping || !session.connected,
            },
          ]}
        />
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={stopping}
          onClick={() => void handleStop()}
          data-testid="cc-monitor-session-stop"
        >
          <PhoneOff size={14} />
          {t('callcenter.supervisor.monitorBar.stop', 'Stop')}
        </Button>
      </HStack>
    </Flex>
  );
}
