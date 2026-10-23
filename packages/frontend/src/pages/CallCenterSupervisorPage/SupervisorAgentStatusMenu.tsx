import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, LogIn, LogOut, Pause, Play } from 'lucide-react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, Text, VStack,
} from '@/shared/ui';
import { StatusPill } from '@/features/callcenter/ui/StatusPill';
import { supervisorStatusActions } from '@/features/callcenter/lib/supervisorPulse';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './SupervisorPulse.module.scss';

export interface SupervisorAgentStatusMenuProps {
  agent: IAgent;
  elapsed?: ReactNode;
  busy?: boolean;
  onStartShift: (agent: IAgent) => void;
  onEndShift: (agent: IAgent) => void;
  onPause: (agent: IAgent) => void;
  onUnpause: (agent: IAgent) => void;
}

/** Shift/pause actions share one trigger; call-derived states remain read-only. */
export function SupervisorAgentStatusMenu({ agent, elapsed, busy, ...actions }: SupervisorAgentStatusMenuProps) {
  const { t } = useTranslation();
  const allowed = supervisorStatusActions(agent);
  return (
    <VStack gap="2" className={styles.statusCell}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="unstyled" size="none" className={styles.statusTrigger}
            disabled={busy} aria-label={t('callcenter.supervisor.pulse.changeStatus', { name: agent.name })}
            data-testid={`supervisor-status-${agent.interface}`}>
            <StatusPill status={agent.status} phoneOnline={agent.phoneOnline}
              queuesDetached={agent.queuesDetached} className={styles.plainStatus} />
            <ChevronDown size={13} aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={styles.statusMenu}>
          <DropdownMenuLabel>{agent.name}</DropdownMenuLabel>
          {allowed.start ? (
            <DropdownMenuItem onSelect={() => actions.onStartShift(agent)}>
              <LogIn aria-hidden />{t('callcenter.supervisor.startShift', 'Start shift')}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem disabled={!allowed.resume} onSelect={() => actions.onUnpause(agent)}>
                <Play aria-hidden />{t('callcenter.supervisor.pulse.available')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!allowed.pause} onSelect={() => actions.onPause(agent)}>
                <Pause aria-hidden />{t('callcenter.supervisor.pause', 'Pause')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!allowed.end} onSelect={() => actions.onEndShift(agent)}>
                <LogOut aria-hidden />{t('callcenter.supervisor.bulk.endShift', 'End shift')}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <Text variant="xs" className={styles.menuHint}>{t('callcenter.supervisor.pulse.automaticStates')}</Text>
        </DropdownMenuContent>
      </DropdownMenu>
      {(agent.pauseReason || elapsed) && <Text variant="xs" className={styles.statusMeta}>
        {agent.status === 'PAUSED' && agent.pauseReason ? `${agent.pauseReason} · ` : ''}{elapsed}
      </Text>}
    </VStack>
  );
}
