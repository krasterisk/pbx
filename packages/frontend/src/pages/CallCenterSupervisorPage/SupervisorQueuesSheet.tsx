import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button, Flex, FormSheetContent, HStack, Input, ModalBody, Sheet, SheetFooter, SheetHeader, SheetTitle, Switch, Text, VStack } from '@/shared/ui';
import { QueryErrorState } from '@/shared/ui/QueryErrorState';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { useSupervisorQueueAddMutation, useSupervisorQueueRemoveMutation, useSupervisorReconcileQueuesMutation } from '@/shared/api/endpoints/callCenterApi';
import { selectCcAgents, selectCcQueues } from '@/features/callcenter/model/selectors/callCenterSelectors';
import { updateAgent } from '@/features/callcenter/model/slice/callCenterSlice';
import { queueDisplayName } from '@/features/callcenter/lib/displayLabels';
import { supervisorQueueAllowed, supervisorStatusActions } from '@/features/callcenter/lib/supervisorPulse';
import type { IAgent } from '@/features/callcenter/model/types/callCenterSchema';
import styles from './SupervisorPulse.module.scss';

export interface SupervisorQueuesSheetProps {
  agent: IAgent | null;
  open: boolean;
  onClose: () => void;
  allowedQueues: readonly string[] | null;
}

export function SupervisorQueuesSheet({ agent: initialAgent, open, onClose, allowedQueues }: SupervisorQueuesSheetProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const reduxStore = useStore();
  const agents = useSelector(selectCcAgents);
  const liveQueues = useSelector(selectCcQueues);
  const agent = agents.find(row => row.interface === initialAgent?.interface) ?? initialAgent;
  const { data: dbQueues = [], isLoading, isError, refetch } = useGetQueuesQuery(undefined, { skip: !open });
  const [reconcile] = useSupervisorReconcileQueuesMutation();
  const [add] = useSupervisorQueueAddMutation();
  const [remove] = useSupervisorQueueRemoveMutation();
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [membershipError, setMembershipError] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [search, setSearch] = useState('');
  const iface = initialAgent?.interface;
  const active = agent ? supervisorStatusActions(agent).queues : false;

  useEffect(() => {
    if (!open || !iface || iface.startsWith('user:') || !active) return;
    let current = true;
    setReadyFor(null);
    setMembershipError(false);
    void reconcile({ agentInterface: iface }).unwrap().then(result => {
      if (!current) return;
      if (result.queues) dispatch(updateAgent({ interface: iface, queues: result.queues, queuesDetached: false }));
      setReadyFor(iface);
    }).catch(() => { if (current) setMembershipError(true); });
    return () => { current = false; };
  }, [open, iface, active, retry, reconcile, dispatch]);

  const catalog = useMemo(() => {
    const entries = new Map<string, { name: string; displayName: string; exten?: string }>();
    dbQueues.forEach(queue => entries.set(queue.name, { name: queue.name, displayName: queue.display_name || queue.name, exten: queue.exten }));
    liveQueues.forEach(queue => { if (!entries.has(queue.name)) entries.set(queue.name, { name: queue.name, displayName: queue.displayName }); });
    agent?.queues.forEach(name => { if (!entries.has(name)) entries.set(name, { name, displayName: name }); });
    return [...entries.values()].filter(queue => supervisorQueueAllowed(queue.name, queue.exten, allowedQueues))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [dbQueues, liveQueues, agent?.queues, allowedQueues]);
  const rows = catalog.filter(queue => `${queue.displayName} ${queue.exten ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  const changeMembership = async (queue: string, enabled: boolean) => {
    if (!agent || !active || readyFor !== agent.interface || pendingRef.current) return;
    const previous = [...agent.queues];
    const detached = agent.queuesDetached;
    const next = enabled ? [...new Set([...previous, queue])] : previous.filter(name => name !== queue);
    pendingRef.current = true;
    setPending(true);
    setWriteError(false);
    dispatch(updateAgent({ interface: agent.interface, queues: next, queuesDetached: false }));
    try {
      const result = await (enabled ? add({ agentInterface: agent.interface, queue }) : remove({ agentInterface: agent.interface, queue })).unwrap();
      dispatch(updateAgent({ interface: agent.interface, queues: result.queues ?? next, queuesDetached: false }));
    } catch {
      const current = (reduxStore.getState() as { callCenter?: { agents: IAgent[] } }).callCenter?.agents.find(row => row.interface === agent.interface);
      if (current?.queues === next) dispatch(updateAgent({ interface: agent.interface, queues: previous, queuesDetached: detached }));
      setWriteError(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return <Sheet open={open && Boolean(agent)} onOpenChange={value => { if (!value) onClose(); }}>
    <FormSheetContent side="right" aria-describedby={undefined} data-testid="supervisor-queues-sheet">
      <SheetHeader><SheetTitle>{t('callcenter.supervisor.pulse.queuesTitle')}</SheetTitle>
        <Text variant="muted">{agent?.name}</Text>
      </SheetHeader>
      <HStack gap="8"><Search size={15} aria-hidden /><Input value={search} onChange={event => setSearch(event.target.value)}
        aria-label={t('callcenter.supervisor.pulse.queueSearch')} placeholder={t('callcenter.supervisor.pulse.queueSearch')} /></HStack>
      <ModalBody>
        {isError ? <QueryErrorState onRetry={refetch} /> : isLoading ? <Text variant="muted">{t('common.loading')}</Text>
          : membershipError ? <QueryErrorState message={t('callcenter.supervisor.pulse.membershipError')}
            onRetry={() => setRetry(value => value + 1)} /> : <VStack gap="8">
            {!active && <Text variant="muted">{t('callcenter.supervisor.pulse.startBeforeQueues')}</Text>}
            {active && readyFor !== iface && <Text variant="muted">{t('callcenter.supervisor.pulse.membershipLoading')}</Text>}
            {rows.length === 0 && <Text variant="muted">{t('callcenter.supervisor.pulse.noAllowedQueues')}</Text>}
            {rows.map(queue => <Flex key={queue.name} justify="between" align="center" gap="16" className={styles.detailRow}>
              <Text>{queueDisplayName(queue.name, catalog)}</Text>
              <Switch checked={active && Boolean(agent?.queues.includes(queue.name))}
                disabled={!active || readyFor !== iface || pending}
                aria-label={queueDisplayName(queue.name, catalog)} onCheckedChange={enabled => { void changeMembership(queue.name, enabled); }} />
            </Flex>)}
          </VStack>}
        {writeError && <Text variant="error" role="alert">{t('callcenter.supervisor.pulse.membershipWriteError')}</Text>}
      </ModalBody>
      <SheetFooter><Text variant="xs" className={styles.secondary}>{t('callcenter.supervisor.pulse.membershipHint')}</Text>
        <Button variant="outline" onClick={onClose}>{t('common.close')}</Button></SheetFooter>
    </FormSheetContent>
  </Sheet>;
}
