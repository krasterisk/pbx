import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import { Loader2, Pause, Play, LogOut, LogIn } from 'lucide-react';
import {
  Button,
  Text,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui';
import {
  useSupervisorForcePauseMutation,
  useSupervisorForceUnpauseMutation,
  useSupervisorForceLogoutMutation,
} from '@/shared/api/endpoints/callCenterApi';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './BulkActionsBar.module.scss';

function hasLiveAgentInterface(iface: string): boolean {
  return Boolean(iface) && !iface.startsWith('user:');
}

function agentNeedsStartShift(agent: IAgent): boolean {
  const live = hasLiveAgentInterface(agent.interface);
  return (!live || agent.status === 'OFFLINE') && agent.userId > 0;
}

function agentCanEndShift(agent: IAgent): boolean {
  if (agentNeedsStartShift(agent)) return false;
  if (!(agent.userId > 0)) return false;
  const live = hasLiveAgentInterface(agent.interface);
  return live && agent.status !== 'OFFLINE';
}

export interface BulkActionsBarProps {
  selectedAgents: IAgent[];
  onClear: () => void;
  /** Open start-shift modal for a single selected offline agent. */
  onStartShift?: (agent: IAgent) => void;
}

export function BulkActionsBar({ selectedAgents, onClear, onStartShift }: BulkActionsBarProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState<'pause' | 'unpause' | 'logout' | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [supervisorForcePause] = useSupervisorForcePauseMutation();
  const [supervisorForceUnpause] = useSupervisorForceUnpauseMutation();
  const [supervisorForceLogout] = useSupervisorForceLogoutMutation();

  const count = selectedAgents.length;

  const { showPause, showUnpause, showStartShift, showEndShift, startShiftAgent } = useMemo(() => {
    const pausable = selectedAgents.filter(
      (a) => hasLiveAgentInterface(a.interface) && a.status === 'READY',
    );
    const unpausable = selectedAgents.filter(
      (a) => hasLiveAgentInterface(a.interface) && a.status === 'PAUSED',
    );
    const needStart = selectedAgents.filter(agentNeedsStartShift);
    const canEnd = selectedAgents.filter(agentCanEndShift);

    return {
      // Inverted: only the relevant side when selection is uniform; both when mixed.
      showPause: pausable.length > 0,
      showUnpause: unpausable.length > 0,
      showStartShift: needStart.length > 0,
      showEndShift: canEnd.length > 0,
      // Start shift needs SIP/queues modal — only when exactly one agent needs it.
      startShiftAgent: needStart.length === 1 ? needStart[0] : null,
    };
  }, [selectedAgents]);

  const runBulk = useCallback(async (
    action: 'pause' | 'unpause' | 'logout',
    targets: IAgent[],
    fn: (agentInterface: string) => Promise<unknown>,
  ) => {
    setBusy(action);
    try {
      await Promise.all(targets.map((a) => fn(a.interface)));
      onClear();
    } finally {
      setBusy(null);
      setConfirmLogout(false);
    }
  }, [onClear]);

  const handlePause = useCallback(() => {
    const targets = selectedAgents.filter(
      (a) => hasLiveAgentInterface(a.interface) && a.status === 'READY',
    );
    return runBulk('pause', targets, (agentInterface) =>
      supervisorForcePause({ agentInterface }).unwrap(),
    );
  }, [runBulk, selectedAgents, supervisorForcePause]);

  const handleUnpause = useCallback(() => {
    const targets = selectedAgents.filter(
      (a) => hasLiveAgentInterface(a.interface) && a.status === 'PAUSED',
    );
    return runBulk('unpause', targets, (agentInterface) =>
      supervisorForceUnpause({ agentInterface }).unwrap(),
    );
  }, [runBulk, selectedAgents, supervisorForceUnpause]);

  const handleLogoutConfirm = useCallback(() => {
    const targets = selectedAgents.filter(agentCanEndShift);
    return runBulk('logout', targets, (agentInterface) =>
      supervisorForceLogout({ agentInterface }).unwrap(),
    );
  }, [runBulk, selectedAgents, supervisorForceLogout]);

  const handleStartShift = useCallback(() => {
    if (!startShiftAgent || !onStartShift) return;
    onStartShift(startShiftAgent);
    onClear();
  }, [startShiftAgent, onStartShift, onClear]);

  if (count === 0) return null;

  const hasShiftOrPause =
    showPause || showUnpause || (showStartShift && startShiftAgent) || showEndShift;

  return (
    <>
      <motion.div
        className={styles.bar}
        role="toolbar"
        aria-label={t('callcenter.supervisor.bulkActions', 'Bulk actions')}
        initial={reduceMotion ? false : { y: 80, opacity: 0, x: '-50%' }}
        animate={reduceMotion ? { x: '-50%' } : { y: 0, opacity: 1, x: '-50%' }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 28 }}
      >
        <Text className={styles.count}>
          {t('callcenter.supervisor.bulk.selected', '{{count}} selected', { count })}
        </Text>
        <div className={styles.actions}>
          {showPause && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy != null}
              onClick={handlePause}
            >
              {busy === 'pause' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
              {t('callcenter.supervisor.bulk.pause', 'Pause')}
            </Button>
          )}
          {showUnpause && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy != null}
              onClick={handleUnpause}
            >
              {busy === 'unpause' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {t('callcenter.supervisor.bulk.unpause', 'Unpause')}
            </Button>
          )}
          {showStartShift && startShiftAgent && onStartShift && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy != null}
              onClick={handleStartShift}
            >
              <LogIn className="w-3.5 h-3.5" />
              {t('callcenter.supervisor.startShift', 'Start shift')}
            </Button>
          )}
          {showEndShift && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy != null}
              onClick={() => setConfirmLogout(true)}
            >
              {busy === 'logout' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              {t('callcenter.supervisor.bulk.endShift', 'End shift')}
            </Button>
          )}
          {!hasShiftOrPause && (
            <Text variant="muted" className="text-xs">
              {t('callcenter.supervisor.bulk.noCommonActions', 'No common actions for selection')}
            </Text>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy != null}
            onClick={onClear}
          >
            {t('callcenter.supervisor.cancel', 'Cancel')}
          </Button>
        </div>
      </motion.div>

      <Dialog open={confirmLogout} onOpenChange={(v) => { if (!v) setConfirmLogout(false); }}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle>
              {t('callcenter.supervisor.bulk.confirmLogoutTitle', 'End agent shifts?')}
            </DialogTitle>
          </DialogHeader>
          <Text>
            {t(
              'callcenter.supervisor.bulk.confirmLogoutBody',
              'End shift for {{count}} agents? Active calls will not be interrupted',
              { count: selectedAgents.filter(agentCanEndShift).length },
            )}
          </Text>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLogout(false)} disabled={busy != null}>
              {t('callcenter.supervisor.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleLogoutConfirm} disabled={busy != null}>
              {busy === 'logout' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {t('callcenter.supervisor.bulk.endShift', 'End shift')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
