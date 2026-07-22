import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Headphones, PhoneOff, Users } from 'lucide-react';
import {
  Text, Popover, PopoverTrigger, PopoverContent, SegmentedControl,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button,
} from '@/shared/ui';
import {
  usePeerSpyMutation,
  useGetEffectivePermissionsQuery,
  useSupervisorHangupCallMutation,
} from '@/shared/api/endpoints/callCenterApi';
import { UserLevel, selectCurrentUser } from '@/entities/User';
import {
  selectCcAgents,
  selectMyAgent,
} from '@/features/callcenter/model/selectors/callCenterSelectors';
import { agentDisplayName, agentStatusLabel } from '@/features/callcenter/lib/displayLabels';
import { interfaceToExtension } from '@/features/endpoints/lib/endpointIds';
import { DroppableColleague, useDragTransfer } from '@/features/callcenter/ui/DragTransfer/DragTransfer';
import type { IAgent, AgentStatus } from '@/features/callcenter/model/types/callCenterSchema';
import type { SpyMode } from '@/shared/api/endpoints/callCenterApi';
import styles from './CoworkersTab.module.scss';

interface CoworkersTabProps {
  /** Whether the operator has an active call — enables click/drag-to-transfer on rows (D-21). */
  hasActiveCall: boolean;
}

function presenceDotClass(status: AgentStatus): string {
  if (status === 'READY') return styles.dotSuccess;
  if (status === 'PAUSED') return styles.dotWarning;
  if (status === 'OFFLINE') return styles.dotMuted;
  return styles.dotDestructive; // IN_CALL/RINGING/DIALING/WRAPUP/CONSULT/ACW — busy
}

const SPY_MODES: { value: SpyMode; labelKey: string; fallback: string }[] = [
  { value: 'listen', labelKey: 'callcenter.coworkersTab.spy.listen', fallback: 'Listen' },
  { value: 'whisper', labelKey: 'callcenter.coworkersTab.spy.whisper', fallback: 'Whisper' },
  { value: 'barge', labelKey: 'callcenter.coworkersTab.spy.barge', fallback: 'Barge' },
];

/**
 * Coworkers tab (Surface 5, D-21…D-26) — presence rows with click/drag-to-transfer,
 * a permission-gated ChanSpy mode picker, and a supervisor-only hangup action.
 *
 * ChanSpy visibility uses `can_spy` (own effective right) + target `IN_CALL` as the
 * client-side gate — `spyable`/shared-queue/mode enforcement all happen server-side
 * in peerSpy (D-21/D-22/D-23), since no per-target `spyable` flag is exposed to the
 * client yet (only self-effective permissions, via 09-13's endpoint).
 */
export function CoworkersTab({ hasActiveCall }: CoworkersTabProps) {
  const { t } = useTranslation();
  // agentStatusLabel expects a plain (key, fallback) => string signature —
  // i18next's TFunction overloads don't structurally match it directly.
  const tLabel = (key: string, fallback = ''): string => t(key, fallback);
  const currentUser = useSelector(selectCurrentUser);
  const myAgent = useSelector(selectMyAgent);
  const agents = useSelector(selectCcAgents);
  const { data: permissions } = useGetEffectivePermissionsQuery();
  const { requestTransfer } = useDragTransfer();
  const [peerSpy] = usePeerSpyMutation();
  const [supervisorHangupCall] = useSupervisorHangupCallMutation();

  const [spyTarget, setSpyTarget] = useState<string | null>(null);
  const [hangupTarget, setHangupTarget] = useState<IAgent | null>(null);

  const colleagues = useMemo(() => {
    if (!myAgent) return [];
    return agents.filter((a) => a.interface !== myAgent.interface && a.queues.some((q) => myAgent.queues.includes(q)));
  }, [agents, myAgent]);

  const isSupervisor = (currentUser?.level ?? -1) >= UserLevel.SUPERVISOR;

  const handleSpyMode = async (targetInterface: string, mode: SpyMode) => {
    setSpyTarget(null);
    try {
      await peerSpy({ targetInterface, mode }).unwrap();
    } catch (err: any) {
      console.warn('Peer spy failed:', err?.data?.message || err?.message);
    }
  };

  const confirmHangup = async () => {
    if (!hangupTarget?.currentCall) return;
    try {
      await supervisorHangupCall({ uniqueid: hangupTarget.currentCall }).unwrap();
    } catch (err: any) {
      console.warn('Supervisor hangup failed:', err?.data?.message || err?.message);
    }
    setHangupTarget(null);
  };

  if (colleagues.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.empty}>
          <Users className="w-8 h-8 opacity-30" />
          <Text className="font-semibold">{t('callcenter.coworkersTab.emptyTitle', 'No coworkers online')}</Text>
          <Text variant="muted" className="text-sm">
            {t('callcenter.coworkersTab.emptyBody', 'Agents sharing your queues will appear here')}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-testid="coworkers-tab">
      {colleagues.map((agent) => {
        const canClickTransfer = hasActiveCall && agent.status === 'READY';
        const canSpy = !!permissions?.can_spy && agent.status === 'IN_CALL';
        const canHangup = isSupervisor && !!agent.currentCall;
        return (
          <DroppableColleague
            key={agent.interface}
            agent={agent}
            className={`${styles.row} ${canClickTransfer ? styles.rowClickable : ''}`}
            onColleagueClick={canClickTransfer ? () => requestTransfer(agent) : undefined}
          >
            <span className={`${styles.dot} ${presenceDotClass(agent.status)}`} />
            <div className={styles.info}>
              <span className={styles.name}>{agentDisplayName(agent)}</span>
              <span className={styles.meta}>
                <span>{interfaceToExtension(agent.interface)}</span>
                <span>·</span>
                <span>{agentStatusLabel(agent.status, tLabel)}</span>
              </span>
            </div>
            <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
              {canSpy && (
                <Popover open={spyTarget === agent.interface} onOpenChange={(open) => setSpyTarget(open ? agent.interface : null)}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={t('callcenter.coworkersTab.spyAria', 'Listen in on {{name}}', { name: agentDisplayName(agent) })}
                    >
                      <Headphones className="w-4 h-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <div className={styles.spyPicker}>
                      <Text className="text-xs font-semibold">
                        {t('callcenter.coworkersTab.spyPickerTitle', 'ChanSpy mode')}
                      </Text>
                      <SegmentedControl
                        value=""
                        onChange={(mode) => handleSpyMode(agent.interface, mode as SpyMode)}
                        options={SPY_MODES.map((m) => ({
                          value: m.value,
                          label: t(m.labelKey, m.fallback),
                          disabled: !permissions?.spy_modes?.includes(m.value),
                          tooltipContent: !permissions?.spy_modes?.includes(m.value)
                            ? t('callcenter.coworkersTab.spyModeBlocked', 'This mode is not granted to you')
                            : undefined,
                        }))}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {canHangup && (
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  aria-label={t('callcenter.coworkersTab.hangupAria', 'Hang up {{name}}\u2019s call', { name: agentDisplayName(agent) })}
                  onClick={() => setHangupTarget(agent)}
                >
                  <PhoneOff className="w-4 h-4" />
                </button>
              )}
            </div>
          </DroppableColleague>
        );
      })}

      <Dialog open={!!hangupTarget} onOpenChange={(open) => !open && setHangupTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('callcenter.coworkersTab.hangupConfirmTitle', 'Hang up {{name}}\u2019s call?', {
                name: hangupTarget ? agentDisplayName(hangupTarget) : '',
              })}
            </DialogTitle>
          </DialogHeader>
          <Text variant="muted" className="text-sm">
            {t('callcenter.coworkersTab.hangupConfirmBody', 'This ends the call immediately for both parties.')}
          </Text>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button variant="destructive" onClick={confirmHangup} className="w-full">
              {t('callcenter.coworkersTab.hangupConfirmAction', 'Hang up')}
            </Button>
            <Button variant="ghost" onClick={() => setHangupTarget(null)} className="w-full">
              {t('callcenter.dnd.cancel', 'Cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
