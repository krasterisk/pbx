import { useTranslation } from 'react-i18next';
import { ChevronDown, History, PhoneOutgoing, PhoneCall, Layers } from 'lucide-react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui';
import styles from './SupervisorPulse.module.scss';

export function SupervisorJournalsMenu({ onHistory, onCallbacks, onCalls, onQueues }: {
  onHistory: () => void;
  onCallbacks: () => void;
  onCalls: () => void;
  onQueues: () => void;
}) {
  const { t } = useTranslation();
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="unstyled" size="none" className={styles.clearControl} data-testid="cc-journal-menu">
        {t('callcenter.supervisor.pulse.journals')}<ChevronDown size={14} aria-hidden />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={onCalls}><PhoneCall aria-hidden />{t('callcenter.supervisor.pulse.liveCalls')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={onQueues}><Layers aria-hidden />{t('callcenter.supervisor.pulse.queueState')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={onHistory} data-testid="cc-journal-history"><History />{t('callcenter.supervisor.cockpit.journalHistory', 'Call history')}</DropdownMenuItem>
      <DropdownMenuItem onSelect={onCallbacks} data-testid="cc-journal-callbacks"><PhoneOutgoing />{t('callcenter.supervisor.cockpit.journalCallbacks', 'Callback requests')}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
