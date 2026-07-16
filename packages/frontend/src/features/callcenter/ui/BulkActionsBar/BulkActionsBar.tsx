import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import { Loader2, Pause, Play, LogOut } from 'lucide-react';
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
import styles from './BulkActionsBar.module.scss';

export interface BulkActionsBarProps {
  selectedInterfaces: string[];
  onClear: () => void;
}

export function BulkActionsBar({ selectedInterfaces, onClear }: BulkActionsBarProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState<'pause' | 'unpause' | 'logout' | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [supervisorForcePause] = useSupervisorForcePauseMutation();
  const [supervisorForceUnpause] = useSupervisorForceUnpauseMutation();
  const [supervisorForceLogout] = useSupervisorForceLogoutMutation();

  const count = selectedInterfaces.length;

  const runBulk = useCallback(async (
    action: 'pause' | 'unpause' | 'logout',
    fn: (agentInterface: string) => Promise<unknown>,
  ) => {
    setBusy(action);
    try {
      await Promise.all(selectedInterfaces.map((agentInterface) => fn(agentInterface)));
      onClear();
    } finally {
      setBusy(null);
      setConfirmLogout(false);
    }
  }, [selectedInterfaces, onClear]);

  const handlePause = useCallback(() => {
    return runBulk('pause', (agentInterface) =>
      supervisorForcePause({ agentInterface }).unwrap(),
    );
  }, [runBulk, supervisorForcePause]);

  const handleUnpause = useCallback(() => {
    return runBulk('unpause', (agentInterface) =>
      supervisorForceUnpause({ agentInterface }).unwrap(),
    );
  }, [runBulk, supervisorForceUnpause]);

  const handleLogoutConfirm = useCallback(() => {
    return runBulk('logout', (agentInterface) =>
      supervisorForceLogout({ agentInterface }).unwrap(),
    );
  }, [runBulk, supervisorForceLogout]);

  if (count === 0) return null;

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
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy != null}
            onClick={() => setConfirmLogout(true)}
          >
            {busy === 'logout' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            {t('callcenter.supervisor.bulk.logout', 'Log out')}
          </Button>
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
              {t('callcenter.supervisor.bulk.confirmLogoutTitle', 'Log out agents?')}
            </DialogTitle>
          </DialogHeader>
          <Text>
            {t(
              'callcenter.supervisor.bulk.confirmLogoutBody',
              'Log out {{count}} agents? Active calls will not be interrupted',
              { count },
            )}
          </Text>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmLogout(false)} disabled={busy != null}>
              {t('callcenter.supervisor.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleLogoutConfirm} disabled={busy != null}>
              {busy === 'logout' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {t('callcenter.supervisor.bulk.logout', 'Log out')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
