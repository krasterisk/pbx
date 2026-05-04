import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X, Phone, Hash, Trash2, Pause, Play, Volume2,
  Users, Headphones,
} from 'lucide-react';
import { Button, Input, InfoTooltip, MultiSelect } from '@/shared/ui';
import type { MultiSelectOption } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  selectQueuesIsModalOpen,
  selectQueuesModalMode,
  selectQueuesSelectedName,
} from '../../model/selectors/queuesPageSelectors';
import { queuesPageActions } from '../../model/slice/queuesPageSlice';
import {
  useGetQueueQuery,
  useCreateQueueMutation,
  useUpdateQueueMutation,
} from '@/shared/api/endpoints/queueApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import { useGetMohClassesQuery } from '@/shared/api/endpoints/mohApi';
import { useGetEndpointsQuery } from '@/shared/api/api';
import { AdvancedSettingsBuilder } from '@/features/endpoints/ui/AdvancedSettingsBuilder';
import { QUEUE_ADVANCED_FIELDS } from '../../config/queueAdvancedFields';
import { IQueueMember } from '../../model/types/queuesSchema';
import cls from './QueueFormModal.module.scss';

// Strategy select options
const STRATEGY_VALUES = ['ringall', 'rrmemory', 'leastrecent', 'fewestcalls', 'random', 'linear', 'wrandom'];

interface LocalMember {
  id: number;
  type: 'endpoint' | 'custom';
  interface: string;
  membername: string;
  penalty: number;
  paused: number;
  extension?: string;
  context?: string;
}

export const QueueFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectQueuesIsModalOpen);
  const mode = useAppSelector(selectQueuesModalMode);
  const selectedName = useAppSelector(selectQueuesSelectedName);

  const { data: queueData, isFetching } = useGetQueueQuery(selectedName!, { skip: !selectedName || mode === 'create' });
  const [createQueue, { isLoading: isCreating }] = useCreateQueueMutation();
  const [updateQueue, { isLoading: isUpdating }] = useUpdateQueueMutation();
  const { data: contexts = [] } = useGetContextsQuery();
  const { data: prompts = [] } = useGetPromptsQuery();
  const { data: mohClasses = [] } = useGetMohClassesQuery(undefined, { skip: !isOpen });
  const { data: endpoints = [] } = useGetEndpointsQuery();

  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'announcements' | 'advanced'>('general');

  // === General ===
  const [exten, setExten] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [strategy, setStrategy] = useState('ringall');
  const [timeout, setTimeout] = useState('30');
  const [retry, setRetry] = useState('5');
  const [wrapuptime, setWrapuptime] = useState('0');
  const [maxlen, setMaxlen] = useState('0');
  const [musiconhold, setMusiconhold] = useState('');
  const [context, setContext] = useState('');
  const [weight, setWeight] = useState('0');
  const [servicelevel, setServicelevel] = useState('60');
  const [joinempty, setJoinempty] = useState('');
  const [leavewhenempty, setLeavewhenempty] = useState('');
  const [ringinuse, setRinginuse] = useState(true);
  const [autofill, setAutofill] = useState(true);
  const [setinterfacevar, setSetinterfacevar] = useState(true);
  const [setqueueentryvar, setSetqueueentryvar] = useState(true);
  const [setqueuevar, setSetqueuevar] = useState(true);

  // === Members ===
  const [members, setMembers] = useState<LocalMember[]>([]);
  const [memberMode, setMemberMode] = useState<'endpoint' | 'custom'>('endpoint');
  const [searchQuery, setSearchQuery] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [customContext, setCustomContext] = useState('');

  // === Announcements (caller-facing) ===
  const [announceFrequency, setAnnounceFrequency] = useState('');
  const [minAnnounceFrequency, setMinAnnounceFrequency] = useState('');
  const [announceHoldtime, setAnnounceHoldtime] = useState('');
  const [announcePosition, setAnnouncePosition] = useState('');
  const [announcePositionLimit, setAnnouncePositionLimit] = useState('5');
  const [announceRoundSeconds, setAnnounceRoundSeconds] = useState('');
  const [periodicAnnounce, setPeriodicAnnounce] = useState('');
  const [periodicAnnounceFrequency, setPeriodicAnnounceFrequency] = useState('');
  // Sound file overrides
  const [queueYouarenext, setQueueYouarenext] = useState('');
  const [queueThereare, setQueueThereare] = useState('');
  const [queueCallswaiting, setQueueCallswaiting] = useState('');
  const [queueHoldtime, setQueueHoldtime] = useState('');
  const [queueMinutes, setQueueMinutes] = useState('');
  const [queueSeconds, setQueueSeconds] = useState('');
  const [queueLessthan, setQueueLessthan] = useState('');
  const [queueThankyou, setQueueThankyou] = useState('');

  // === Agent-facing ===
  const [announce, setAnnounce] = useState('');
  const [reportholdtime, setReportholdtime] = useState(false);
  const [memberdelay, setMemberdelay] = useState('0');

  // === Advanced ===
  const [advancedState, setAdvancedState] = useState<Record<string, string>>({});

  // Build MultiSelect options for joinempty/leavewhenempty
  const emptyFlagOptions: MultiSelectOption[] = useMemo(() => [
    { value: 'yes', label: t('queues.emptyFlag.yes'), description: t('queues.emptyFlagDesc.yes') },
    { value: 'no', label: t('queues.emptyFlag.no'), description: t('queues.emptyFlagDesc.no') },
    { value: 'strict', label: t('queues.emptyFlag.strict'), description: t('queues.emptyFlagDesc.strict') },
    { value: 'loose', label: t('queues.emptyFlag.loose'), description: t('queues.emptyFlagDesc.loose') },
    { value: 'paused', label: t('queues.emptyFlag.paused'), description: t('queues.emptyFlagDesc.paused') },
    { value: 'penalty', label: t('queues.emptyFlag.penalty'), description: t('queues.emptyFlagDesc.penalty') },
    { value: 'inuse', label: t('queues.emptyFlag.inuse'), description: t('queues.emptyFlagDesc.inuse') },
    { value: 'ringing', label: t('queues.emptyFlag.ringing'), description: t('queues.emptyFlagDesc.ringing') },
    { value: 'unavailable', label: t('queues.emptyFlag.unavailable'), description: t('queues.emptyFlagDesc.unavailable') },
    { value: 'invalid', label: t('queues.emptyFlag.invalid'), description: t('queues.emptyFlagDesc.invalid') },
    { value: 'unknown', label: t('queues.emptyFlag.unknown'), description: t('queues.emptyFlagDesc.unknown') },
    { value: 'wrapup', label: t('queues.emptyFlag.wrapup'), description: t('queues.emptyFlagDesc.wrapup') },
  ], [t]);

  // Reset form
  useEffect(() => {
    if (mode === 'create') return;
    setActiveTab('general');

    if ((mode === 'edit' || mode === 'copy') && queueData) {
      setExten(mode === 'copy' ? '' : (queueData.exten || queueData.name || ''));
      setDisplayName(mode === 'copy' ? `${queueData.display_name || ''} (${t('common.copy', 'копия')})` : (queueData.display_name || ''));
      setStrategy(queueData.strategy || 'ringall');
      setTimeout(String(queueData.timeout ?? 30));
      setRetry(String(queueData.retry ?? 5));
      setWrapuptime(String(queueData.wrapuptime ?? 0));
      setMaxlen(String(queueData.maxlen ?? 0));
      setMusiconhold(queueData.musiconhold || '');
      setContext(queueData.context || '');
      setWeight(String(queueData.weight ?? 0));
      setServicelevel(String(queueData.servicelevel ?? 60));
      setJoinempty(queueData.joinempty || '');
      setLeavewhenempty(queueData.leavewhenempty || '');
      setRinginuse(!!queueData.ringinuse);
      setAutofill(queueData['autofill'] !== false && queueData['autofill'] !== 'no');
      
      // Announcements
      setAnnounce(queueData.announce || '');
      setAnnounceFrequency(String(queueData.announce_frequency || ''));
      setMinAnnounceFrequency(String(queueData.min_announce_frequency || ''));
      setAnnounceHoldtime(queueData.announce_holdtime || '');
      setAnnouncePosition(queueData['announce_position'] || '');
      setAnnouncePositionLimit(String(queueData['announce_position_limit'] ?? 5));
      setAnnounceRoundSeconds(String(queueData.announce_round_seconds ?? ''));
      setPeriodicAnnounce(queueData.periodic_announce || '');
      setPeriodicAnnounceFrequency(String(queueData.periodic_announce_frequency ?? ''));
      setQueueYouarenext(queueData.queue_youarenext || '');
      setQueueThereare(queueData.queue_thereare || '');
      setQueueCallswaiting(queueData.queue_callswaiting || '');
      setQueueHoldtime(queueData.queue_holdtime || '');
      setQueueMinutes(queueData.queue_minutes || '');
      setQueueSeconds(queueData.queue_seconds || '');
      setQueueLessthan(queueData.queue_lessthan || '');
      setQueueThankyou(queueData.queue_thankyou || '');

      // Agent-facing
      setAnnounce(queueData.announce || '');
      setReportholdtime(!!queueData['reportholdtime']);
      setMemberdelay(String(queueData['memberdelay'] ?? 0));

      // Members
      const loadedMembers: LocalMember[] = (queueData.members || []).map((m: IQueueMember, idx: number) => {
        const isPjsip = m.interface.startsWith('PJSIP/');
        const isLocal = m.interface.startsWith('Local/');
        if (isPjsip) {
          const ext = m.interface.replace('PJSIP/', '');
          return { id: Date.now() + idx, type: 'endpoint' as const, interface: m.interface, membername: m.membername || ext, penalty: m.penalty || 0, paused: m.paused || 0, extension: ext };
        }
        let num = m.interface;
        let ctx = '';
        if (isLocal) {
          const match = m.interface.match(/^Local\/(.+)@(.+)$/);
          if (match) { num = match[1]; ctx = match[2]; }
        }
        return { id: Date.now() + idx, type: 'custom' as const, interface: m.interface, membername: m.membername || num, penalty: m.penalty || 0, paused: m.paused || 0, extension: num, context: ctx };
      });
      setMembers(loadedMembers);

      // Advanced
      const initAdv: Record<string, string> = {};
      QUEUE_ADVANCED_FIELDS.forEach(key => {
        if (queueData[key] !== undefined && queueData[key] !== null && queueData[key] !== '') {
          initAdv[key] = String(queueData[key]);
        }
      });
      setAdvancedState(initAdv);
    } else {
      // Create defaults
      setExten(''); setDisplayName(''); setStrategy('ringall'); setTimeout('30'); setRetry('5');
      setWrapuptime('0'); setMaxlen('0'); setMusiconhold(''); setContext('');
      setWeight('0'); setServicelevel('60'); setJoinempty(''); setLeavewhenempty('');
      setRinginuse(false); setAutofill(true);
      setSetinterfacevar(true); setSetqueueentryvar(true); setSetqueuevar(true);
      setMembers([]);
      setAnnounceFrequency(''); setAnnounceHoldtime(''); setAnnouncePosition('');
      setAnnouncePositionLimit('5'); setAnnounceRoundSeconds('');
      setPeriodicAnnounce(''); setPeriodicAnnounceFrequency('');
      setQueueYouarenext(''); setQueueThereare(''); setQueueCallswaiting('');
      setQueueHoldtime(''); setQueueMinutes(''); setQueueSeconds('');
      setQueueLessthan(''); setQueueThankyou('');
      setAnnounce(''); setReportholdtime(false); setMemberdelay('0');
      setAdvancedState({});
    }
  }, [isOpen, mode, queueData]);

  const handleClose = useCallback(() => dispatch(queuesPageActions.closeModal()), [dispatch]);

  // Members logic
  const addEndpointMember = useCallback((ext: string, displayName: string) => {
    if (members.some(m => m.interface === `PJSIP/${ext}`)) return;
    setMembers(prev => [...prev, { id: Date.now(), type: 'endpoint', interface: `PJSIP/${ext}`, membername: displayName || ext, penalty: 0, paused: 0, extension: ext }]);
    setSearchQuery('');
  }, [members]);

  const addCustomMember = useCallback(() => {
    if (!customNumber.trim()) return;
    const ctx = customContext || 'from-internal';
    const iface = `Local/${customNumber.trim()}@${ctx}`;
    if (members.some(m => m.interface === iface)) return;
    setMembers(prev => [...prev, { id: Date.now(), type: 'custom', interface: iface, membername: customNumber.trim(), penalty: 0, paused: 0, extension: customNumber.trim(), context: ctx }]);
    setCustomNumber('');
  }, [customNumber, customContext, members]);

  const removeMember = useCallback((id: number) => { setMembers(prev => prev.filter(m => m.id !== id)); }, []);
  const updateMemberPenalty = useCallback((id: number, penalty: number) => { setMembers(prev => prev.map(m => m.id === id ? { ...m, penalty } : m)); }, []);
  const toggleMemberPause = useCallback((id: number) => { setMembers(prev => prev.map(m => m.id === id ? { ...m, paused: m.paused ? 0 : 1 } : m)); }, []);

  const filteredEndpoints = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const addedInterfaces = new Set(members.filter(m => m.type === 'endpoint').map(m => m.interface));
    return endpoints
      .filter((ep: any) => {
        const ext = ep.extension || ep.id || '';
        const callerid = ep.callerid || '';
        return !addedInterfaces.has(`PJSIP/${ext}`) && (ext.toLowerCase().includes(q) || callerid.toLowerCase().includes(q));
      })
      .slice(0, 8);
  }, [searchQuery, endpoints, members]);

  // Submit
  const handleSubmit = async () => {
    const dto: any = {
      exten, display_name: displayName || null, strategy,
      timeout: Number(timeout) || 30, retry: Number(retry) || 5,
      wrapuptime: Number(wrapuptime) || 0, maxlen: Number(maxlen) || 0,
      musiconhold: musiconhold || null, context: context || null,
      weight: Number(weight) || 0, servicelevel: Number(servicelevel) || 60,
      joinempty: joinempty || null, leavewhenempty: leavewhenempty || null,
      ringinuse, autofill: autofill ? 'yes' : 'no',
      setinterfacevar: 'yes',
      setqueueentryvar: 'yes',
      setqueuevar: 'yes',
      // Announcements
      announce: announce || null,
      announce_frequency: Number(announceFrequency) || null,
      min_announce_frequency: Number(minAnnounceFrequency) || null,
      announce_holdtime: announceHoldtime || null,
      announce_position: announcePosition || null,
      announce_position_limit: Number(announcePositionLimit) || null,
      announce_round_seconds: Number(announceRoundSeconds) || null,
      periodic_announce: periodicAnnounce || null,
      periodic_announce_frequency: Number(periodicAnnounceFrequency) || null,
      queue_youarenext: queueYouarenext || null,
      queue_thereare: queueThereare || null,
      queue_callswaiting: queueCallswaiting || null,
      queue_holdtime: queueHoldtime || null,
      queue_minutes: queueMinutes || null,
      queue_seconds: queueSeconds || null,
      queue_lessthan: queueLessthan || null,
      queue_thankyou: queueThankyou || null,
      reportholdtime: reportholdtime ? 'yes' : 'no',
      memberdelay: Number(memberdelay) || 0,
      // Members
      members: members.map(m => ({ interface: m.interface, membername: m.membername, penalty: m.penalty, paused: m.paused })),
      advanced: advancedState,
    };

    const isCreateMode = mode === 'create' || mode === 'copy';

    try {
      if (isCreateMode) await createQueue(dto).unwrap();
      else await updateQueue({ name: queueData?.name || '', data: dto }).unwrap();
      handleClose();
    } catch (e: any) {
      alert(e.data?.message || 'Error saving queue');
    }
  };

  const isLoading = isCreating || isUpdating || isFetching;

  // Helper: Prompt select
  const PromptSelect = ({ value, onChange, label, tooltip }: { value: string; onChange: (v: string) => void; label: string; tooltip?: string }) => (
    <VStack gap="4">
      <HStack gap="4" align="center">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </HStack>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent"
      >
        <option value="">{t('queues.defaultPrompt')}</option>
        {prompts.map((p: any) => (
          <option key={p.uid} value={p.filename || p.comment}>{p.comment || p.filename}</option>
        ))}
      </select>
    </VStack>
  );

  // Helper: Multi-prompt select (comma-separated value, e.g. periodic-announce)
  const MultiPromptSelect = ({ value, onChange, label, tooltip }: { value: string; onChange: (v: string) => void; label: string; tooltip?: string }) => {
    const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
    const addPrompt = (file: string) => {
      if (!file || selected.includes(file)) return;
      onChange([...selected, file].join(','));
    };
    const removePrompt = (file: string) => {
      onChange(selected.filter(s => s !== file).join(','));
    };
    // Find display name for a filename
    const getDisplayName = (file: string) => {
      const found = prompts.find((p: any) => (p.filename || p.comment) === file);
      return found ? (found.comment || found.filename) : file;
    };

    return (
      <VStack gap="4">
        <HStack gap="4" align="center">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          {tooltip && <InfoTooltip text={tooltip} />}
        </HStack>
        {selected.length > 0 && (
          <div className={cls.flagGrid}>
            {selected.map((file, idx) => (
              <span key={`${file}-${idx}`} className={cls.promptChip}>
                <span className="truncate max-w-[180px]">{getDisplayName(file)}</span>
                <button type="button" className={cls.promptChipRemove} onClick={() => removePrompt(file)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <select
          value=""
          onChange={e => { addPrompt(e.target.value); e.target.value = ''; }}
          className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent"
        >
          <option value="">{t('queues.addPromptPlaceholder')}</option>
          {prompts.filter((p: any) => !selected.includes(p.filename || p.comment)).map((p: any) => (
            <option key={p.uid} value={p.filename || p.comment}>{p.comment || p.filename}</option>
          ))}
        </select>
      </VStack>
    );
  };

  // Helper: toggle with description
  const ToggleField = ({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) => (
    <label className={cls.toggleField}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 text-primary rounded" />
      <VStack gap="2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground leading-snug">{desc}</span>
      </VStack>
    </label>
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-[5%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-card text-card-foreground border border-border rounded-2xl p-6 z-50 shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
          <HStack justify="between" align="center" className="mb-4 shrink-0">
            <Dialog.Title className="text-xl font-bold">
              {mode === 'edit'
                ? t('queues.editQueue')
                : mode === 'copy'
                  ? t('queues.copyQueue', 'Копировать очередь')
                  : t('queues.createQueue')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </HStack>

          {/* Tabs */}
          <div className="border-b border-border/50 mb-6">
            <HStack gap="8" className="-mb-[1px] flex overflow-x-auto flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {[
                { id: 'general', label: t('queues.tabGeneral') },
                { id: 'members', label: `${t('queues.tabMembers')} (${members.length})` },
                { id: 'announcements', label: t('queues.tabAnnouncements') },
                { id: 'advanced', label: t('queues.tabAdvanced') },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`relative py-3 text-sm font-medium transition-colors whitespace-nowrap shrink-0 bg-transparent outline-none ${
                    activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-primary rounded-t-[1px]" />
                  )}
                </button>
              ))}
            </HStack>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            {/* ═══════════ GENERAL TAB ═══════════ */}
            {activeTab === 'general' && (
              <VStack gap="16">
                {/* Queue extension */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.exten')}</label>
                      <InfoTooltip text={t('queues.extenDesc')} />
                    </HStack>
                    <Input value={exten} onChange={e => setExten(e.target.value)} placeholder="700" className="font-mono" />
                  </VStack>
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.displayName')}</label>
                      <InfoTooltip text={t('queues.displayNameDesc')} />
                    </HStack>
                    <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t('queues.displayNamePlaceholder')} />
                  </VStack>
                </div>

                {/* Strategy select */}
                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label className="text-sm font-medium text-muted-foreground">{t('queues.strategy')}</label>
                    <InfoTooltip text={`${t('queues.strategyDesc')}\n\n${STRATEGY_VALUES.map(s => `• ${t(`queues.strategy.${s}`)}: ${t(`queues.strategy.${s}Desc`)}`).join('\n')}`} />
                  </HStack>
                  <select
                    value={strategy}
                    onChange={e => setStrategy(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent"
                  >
                    {STRATEGY_VALUES.map(s => (
                      <option key={s} value={s}>{t(`queues.strategy.${s}`)}</option>
                    ))}
                  </select>
                </VStack>

                {/* Timing row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.timeout')}</label>
                      <InfoTooltip text={t('queues.timeoutDesc')} />
                    </HStack>
                    <Input type="number" value={timeout} onChange={e => setTimeout(e.target.value)} />
                  </VStack>
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.retry')}</label>
                      <InfoTooltip text={t('queues.retryDesc')} />
                    </HStack>
                    <Input type="number" value={retry} onChange={e => setRetry(e.target.value)} />
                  </VStack>
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.wrapuptime')}</label>
                      <InfoTooltip text={t('queues.wrapuptimeDesc')} />
                    </HStack>
                    <Input type="number" value={wrapuptime} onChange={e => setWrapuptime(e.target.value)} />
                  </VStack>
                </div>

                {/* Limits row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.maxlen')}</label>
                      <InfoTooltip text={t('queues.maxlenDesc')} />
                    </HStack>
                    <Input type="number" value={maxlen} onChange={e => setMaxlen(e.target.value)} />
                  </VStack>
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.weight')}</label>
                      <InfoTooltip text={t('queues.weightDesc')} />
                    </HStack>
                    <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} />
                  </VStack>
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.servicelevel')}</label>
                      <InfoTooltip text={t('queues.servicelevelDesc')} />
                    </HStack>
                    <Input type="number" value={servicelevel} onChange={e => setServicelevel(e.target.value)} />
                  </VStack>
                </div>

                {/* joinempty / leavewhenempty — multi-selects */}
                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label className="text-sm font-medium text-muted-foreground">{t('queues.joinempty')}</label>
                    <InfoTooltip text={t('queues.joinemptyDesc')} />
                  </HStack>
                  <MultiSelect value={joinempty} onChange={setJoinempty} options={emptyFlagOptions} placeholder={t('common.select')} />
                </VStack>
                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label className="text-sm font-medium text-muted-foreground">{t('queues.leavewhenempty')}</label>
                    <InfoTooltip text={t('queues.leavewhenemptyDesc')} />
                  </HStack>
                  <MultiSelect value={leavewhenempty} onChange={setLeavewhenempty} options={emptyFlagOptions} placeholder={t('common.select')} />
                </VStack>

                {/* MOH & Context */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.musiconhold')}</label>
                      <InfoTooltip text={t('queues.musiconholdDesc')} />
                    </HStack>
                    <select value={musiconhold} onChange={e => setMusiconhold(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent">
                      <option value="">default</option>
                      {mohClasses.map((m: any) => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                  </VStack>
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label className="text-sm font-medium text-muted-foreground">{t('queues.context')}</label>
                      <InfoTooltip text={t('queues.contextDesc')} />
                    </HStack>
                    <select value={context} onChange={e => setContext(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent">
                      <option value="">—</option>
                      {contexts.map((c: any) => <option key={c.uid} value={c.name}>{c.name}</option>)}
                    </select>
                  </VStack>
                </div>
              </VStack>
            )}

            {/* ═══════════ MEMBERS TAB ═══════════ */}
            {activeTab === 'members' && (
              <VStack gap="16">
                <VStack gap="8">
                  <HStack gap="4" align="center">
                    <span className="text-sm font-medium text-muted-foreground">{t('queues.addMember')}</span>
                  </HStack>

                  <div className={cls.segmentedToggle}>
                    <button type="button" className={`${cls.segmentBtn} ${memberMode === 'endpoint' ? cls.active : ''}`} onClick={() => setMemberMode('endpoint')}>
                      <HStack gap="4" align="center"><Phone className="w-3.5 h-3.5" /><span>{t('queues.memberEndpoint')}</span></HStack>
                    </button>
                    <button type="button" className={`${cls.segmentBtn} ${memberMode === 'custom' ? cls.active : ''}`} onClick={() => setMemberMode('custom')}>
                      <HStack gap="4" align="center"><Hash className="w-3.5 h-3.5" /><span>{t('queues.memberCustom')}</span></HStack>
                    </button>
                  </div>

                  {memberMode === 'endpoint' && (
                    <VStack gap="4">
                      <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('queues.searchEndpoint')} />
                      {filteredEndpoints.length > 0 && (
                        <VStack gap="2" className="border border-border rounded-lg p-2 max-h-40 overflow-y-auto">
                          {filteredEndpoints.map((ep: any) => {
                            const ext = ep.extension || ep.id;
                            const match = (ep.callerid || '').match(/^"(.+?)"/);
                            const displayName = match ? match[1] : ext;
                            return (
                              <button key={ext} type="button" className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-accent text-sm text-left" onClick={() => addEndpointMember(ext, displayName)}>
                                <Phone className="w-3.5 h-3.5 text-primary" />
                                <span className="font-mono">{ext}</span>
                                <span className="text-muted-foreground">{displayName}</span>
                              </button>
                            );
                          })}
                        </VStack>
                      )}
                    </VStack>
                  )}

                  {memberMode === 'custom' && (
                    <VStack gap="4">
                      <HStack gap="8">
                        <Input className="flex-1" value={customNumber} onChange={e => setCustomNumber(e.target.value)} placeholder={t('queues.customNumber')} onKeyDown={e => e.key === 'Enter' && addCustomMember()} />
                        <select value={customContext} onChange={e => setCustomContext(e.target.value)} className="flex h-9 w-40 rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent">
                          <option value="">{t('queues.defaultContext')}</option>
                          {contexts.map((c: any) => <option key={c.uid} value={c.name}>{c.name}</option>)}
                        </select>
                        <Button variant="outline" size="sm" onClick={addCustomMember} disabled={!customNumber.trim()}>+</Button>
                      </HStack>
                      {customNumber.trim() && <span className={cls.livePreview}>Local/{customNumber.trim()}@{customContext || 'from-internal'}</span>}
                    </VStack>
                  )}
                </VStack>

                {members.length > 0 && (
                  <VStack gap="8">
                    <span className="text-sm font-medium text-muted-foreground">{t('queues.currentMembers')} ({members.length}):</span>
                    <VStack gap="4">
                      {members.map(m => (
                        <div key={m.id} className={cls.memberRow}>
                          {m.type === 'endpoint' ? <Phone className={cls.memberIcon} /> : <Hash className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                          <span className={cls.memberInfo}>
                            {m.type === 'endpoint' ? `${m.extension} — ${m.membername}` : `${m.extension} → ${m.context || 'from-internal'}`}
                          </span>
                          <HStack gap="4" align="center">
                            <span className="text-xs text-muted-foreground">P:</span>
                            <Input className={cls.penaltyInput} type="number" min={0} value={m.penalty} onChange={e => updateMemberPenalty(m.id, Number(e.target.value) || 0)} />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleMemberPause(m.id)} title={m.paused ? t('queues.unpause') : t('queues.pause')}>
                              {m.paused ? <Play className="w-3.5 h-3.5 text-green-500" /> : <Pause className="w-3.5 h-3.5 text-amber-500" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMember(m.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </HStack>
                        </div>
                      ))}
                    </VStack>
                    <span className="text-xs text-muted-foreground">{t('queues.penaltyHint')}</span>
                  </VStack>
                )}

                {members.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">{t('queues.noMembers')}</div>
                )}
              </VStack>
            )}

            {/* ═══════════ ANNOUNCEMENTS TAB ═══════════ */}
            {activeTab === 'announcements' && (
              <VStack gap="16">
                {/* Section 1: Caller Position & Holdtime */}
                <div className={cls.announcementSection}>
                  <div className={cls.announcementTitle}>
                    <Users className="w-4 h-4" />
                    {t('queues.callerAnnouncements')}
                  </div>
                  <VStack gap="12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Column 1: Hold Time & Round Seconds */}
                      <VStack gap="6">
                        <VStack gap="4">
                          <HStack gap="4" align="center">
                            <label className="text-sm font-medium text-muted-foreground">{t('queues.announceHoldtime')}</label>
                            <InfoTooltip text={t('queues.announceHoldtimeDesc')} />
                          </HStack>
                          <select value={announceHoldtime} onChange={e => setAnnounceHoldtime(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent">
                            <option value="">—</option>
                            <option value="yes">{t('common.yes')}</option>
                            <option value="no">{t('common.no')}</option>
                            <option value="once">{t('queues.once')}</option>
                          </select>
                        </VStack>
                        <VStack gap="4">
                          <HStack gap="4" align="center">
                            <label className="text-sm font-medium text-muted-foreground">{t('queues.announceRound')}</label>
                            <InfoTooltip text={t('queues.announceRoundDesc')} />
                          </HStack>
                          <Input type="number" value={announceRoundSeconds} onChange={e => setAnnounceRoundSeconds(e.target.value)} placeholder="10" />
                        </VStack>
                      </VStack>

                      {/* Column 2: Position & Position Limit */}
                      <VStack gap="6">
                        <VStack gap="4">
                          <HStack gap="4" align="center">
                            <label className="text-sm font-medium text-muted-foreground">{t('queues.announcePosition')}</label>
                            <InfoTooltip text={t('queues.announcePositionDesc')} />
                          </HStack>
                          <select value={announcePosition} onChange={e => setAnnouncePosition(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent">
                            <option value="">—</option>
                            <option value="yes">{t('common.yes')}</option>
                            <option value="no">{t('common.no')}</option>
                            <option value="limit">{t('queues.posLimit')}</option>
                            <option value="more">{t('queues.posMore')}</option>
                          </select>
                        </VStack>
                        <VStack gap="4">
                          <HStack gap="4" align="center">
                            <label className="text-sm font-medium text-muted-foreground">{t('queues.announcePositionLimit')}</label>
                            <InfoTooltip text={t('queues.announcePositionLimitDesc')} />
                          </HStack>
                          <Input type="number" value={announcePositionLimit} onChange={e => setAnnouncePositionLimit(e.target.value)} placeholder="5" />
                        </VStack>
                      </VStack>

                      {/* Column 3: Frequency & Min Frequency */}
                      <VStack gap="6">
                        <VStack gap="4">
                          <HStack gap="4" align="center">
                            <label className="text-sm font-medium text-muted-foreground">{t('queues.announceFrequency')}</label>
                            <InfoTooltip text={t('queues.announceFrequencyDesc')} />
                          </HStack>
                          <Input type="number" value={announceFrequency} onChange={e => setAnnounceFrequency(e.target.value)} placeholder="0" />
                        </VStack>
                        <VStack gap="4">
                          <HStack gap="4" align="center">
                            <label className="text-sm font-medium text-muted-foreground">{t('queues.minAnnounceFrequency')}</label>
                            <InfoTooltip text={t('queues.minAnnounceFrequencyDesc')} />
                          </HStack>
                          <Input type="number" value={minAnnounceFrequency} onChange={e => setMinAnnounceFrequency(e.target.value)} placeholder="15" />
                        </VStack>
                      </VStack>
                    </div>
                  </VStack>
                </div>

                {/* Section 2: Periodic announcements */}
                <div className={cls.announcementSection}>
                  <div className={cls.announcementTitle}>
                    <Volume2 className="w-4 h-4" />
                    {t('queues.periodicAnnouncements')}
                  </div>
                  <VStack gap="12">
                    <MultiPromptSelect label={t('queues.periodicAnnounce')} value={periodicAnnounce} onChange={setPeriodicAnnounce} tooltip={t('queues.periodicAnnounceDesc')} />
                    <VStack gap="4">
                      <HStack gap="4" align="center">
                        <label className="text-sm font-medium text-muted-foreground">{t('queues.periodicFrequency')}</label>
                        <InfoTooltip text={t('queues.periodicFrequencyDesc')} />
                      </HStack>
                      <Input type="number" value={periodicAnnounceFrequency} onChange={e => setPeriodicAnnounceFrequency(e.target.value)} placeholder="60" />
                    </VStack>
                  </VStack>
                </div>

                {/* Section 3: Agent-facing */}
                <div className={cls.announcementSection}>
                  <div className={cls.announcementTitle}>
                    <Headphones className="w-4 h-4" />
                    {t('queues.agentAnnouncements')}
                  </div>
                  <VStack gap="12">
                    <PromptSelect label={t('queues.announce')} value={announce} onChange={setAnnounce} tooltip={t('queues.announceDesc')} />
                    <ToggleField checked={reportholdtime} onChange={setReportholdtime} label={t('queues.reportholdtime')} desc={t('queues.reportholdtimeDesc')} />
                    <VStack gap="4">
                      <HStack gap="4" align="center">
                        <label className="text-sm font-medium text-muted-foreground">{t('queues.memberdelay')}</label>
                        <InfoTooltip text={t('queues.memberdelayDesc')} />
                      </HStack>
                      <Input type="number" value={memberdelay} onChange={e => setMemberdelay(e.target.value)} placeholder="0" />
                    </VStack>
                  </VStack>
                </div>

                {/* Section 4: Sound file overrides */}
                <div className={cls.announcementSection}>
                  <div className={cls.announcementTitle}>
                    <Volume2 className="w-4 h-4" />
                    {t('queues.soundOverrides')}
                  </div>
                  <VStack gap="12">
                    <PromptSelect label={t('queues.youarenext')} value={queueYouarenext} onChange={setQueueYouarenext} tooltip={t('queues.youarenextDesc')} />
                    <PromptSelect label={t('queues.thereare')} value={queueThereare} onChange={setQueueThereare} tooltip={t('queues.thereareDesc')} />
                    <PromptSelect label={t('queues.callswaiting')} value={queueCallswaiting} onChange={setQueueCallswaiting} />
                    <PromptSelect label={t('queues.holdtimeSound')} value={queueHoldtime} onChange={setQueueHoldtime} />
                    <PromptSelect label={t('queues.minutesSound')} value={queueMinutes} onChange={setQueueMinutes} />
                    <PromptSelect label={t('queues.secondsSound')} value={queueSeconds} onChange={setQueueSeconds} />
                    <PromptSelect label={t('queues.lessthan')} value={queueLessthan} onChange={setQueueLessthan} />
                    <PromptSelect label={t('queues.thankyou')} value={queueThankyou} onChange={setQueueThankyou} />
                  </VStack>
                </div>
              </VStack>
            )}

            {/* ═══════════ ADVANCED TAB ═══════════ */}
            {activeTab === 'advanced' && (
              <VStack gap="16">
                {/* Toggles moved from General */}
                <VStack gap="8">
                  <ToggleField checked={autofill} onChange={setAutofill} label={t('queues.autofill')} desc={t('queues.autofillDesc')} />
                  <ToggleField checked={ringinuse} onChange={setRinginuse} label={t('queues.ringinuse')} desc={t('queues.ringinuseDesc')} />
                </VStack>
                <AdvancedSettingsBuilder
                  value={advancedState}
                  onChange={setAdvancedState}
                  fields={QUEUE_ADVANCED_FIELDS}
                  title={t('queues.advancedTitle')}
                  description={t('queues.advancedDesc')}
                />
              </VStack>
            )}
          </div>

          {/* Actions */}
          <HStack gap="8" justify="end" className="mt-8 pt-4 border-t border-border shrink-0">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={isLoading || !exten.trim()}>
              {isLoading ? t('common.loading') : t('common.save')}
            </Button>
          </HStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
