import { toast } from 'react-toastify';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  X, Phone, Hash, Trash2, Pause, Play, Volume2,
  Users, Headphones,
} from 'lucide-react';
import { Button, Input, InfoTooltip, MultiSelect, SegmentedControl, Tooltip, Dialog, FormDialogContent, DialogHeader, DialogTitle, DialogFooter, ModalBody, ModalSection, ModalTabs, ModalToggle, Label, Text, Select } from '@/shared/ui';
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
  useDeleteQueueMutation,
} from '@/shared/api/endpoints/queueApi';
import { extractRouteReferences, useGetUsageQuery } from '@/shared/api/endpoints/routeReferencesApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import { useGetMohClassesQuery } from '@/shared/api/endpoints/mohApi';
import { useGetEndpointsQuery } from '@/shared/api/api';
import { AdvancedSettingsBuilder } from '@/features/endpoints/ui/AdvancedSettingsBuilder';
import { QUEUE_ADVANCED_FIELDS } from '../../config/queueAdvancedFields';
import { IQueueMember } from '../../model/types/queuesSchema';
import { extractExtension, interfaceToExtension, isWebrtcCompanion } from '@/features/endpoints/lib/endpointIds';
import { UsageTab } from '@/features/route-references/ui/UsageTab';
import { DeleteBlockedDialog } from '@/features/route-references/ui/DeleteBlockedDialog';
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
  const [deleteQueue, { isLoading: isDeleting }] = useDeleteQueueMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [conflictRefs, setConflictRefs] = useState<ReturnType<typeof extractRouteReferences>>([]);
  const usageQuery = useGetUsageQuery(
    { kind: 'queue', uid: selectedName ?? '' },
    { skip: mode !== 'edit' || !selectedName },
  );
  const { data: contexts = [] } = useGetContextsQuery();
  const { data: prompts = [] } = useGetPromptsQuery();
  const { data: mohClasses = [] } = useGetMohClassesQuery(undefined, { skip: !isOpen });
  const { data: endpoints = [] } = useGetEndpointsQuery();

  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'announcements' | 'advanced' | 'usage'>('general');

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
          const sipId = m.interface.replace(/^PJSIP\//i, '');
          const ext = interfaceToExtension(m.interface) || extractExtension(sipId) || sipId;
          return {
            id: Date.now() + idx,
            type: 'endpoint' as const,
            interface: m.interface,
            membername: m.membername || ext,
            penalty: m.penalty || 0,
            paused: m.paused || 0,
            extension: ext,
          };
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

  const usageRefs = conflictRefs.length ? conflictRefs : (usageQuery.data?.references ?? []);
  const deleteBlocked = Boolean(
    mode === 'edit'
    && selectedName
    && (usageQuery.isLoading || usageQuery.isError || usageRefs.length > 0),
  );
  const deleteHint = usageQuery.isLoading || usageQuery.isError
    ? t('references.errorHint', 'Пока проверка не прошла, удаление недоступно')
    : usageRefs.length > 0
      ? t('references.deleteBlockedTitle', 'Сначала уберите ссылки')
      : undefined;

  const handleDelete = async () => {
    if (!selectedName || deleteBlocked) return;
    try {
      await deleteQueue(selectedName).unwrap();
      setDeleteOpen(false);
      handleClose();
    } catch (err: unknown) {
      const refs = extractRouteReferences(err);
      if (refs.length) {
        setConflictRefs(refs);
        setDeleteOpen(true);
        return;
      }
    }
  };

  // Members logic: always store tenant SIP id (PJSIP/e101_0), never bare PJSIP/101
  const addEndpointMember = useCallback((sipId: string, displayName: string) => {
    if (!sipId || isWebrtcCompanion(sipId)) return;
    const iface = `PJSIP/${sipId}`;
    if (members.some(m => m.interface === iface)) return;
    const ext = extractExtension(sipId) || sipId;
    setMembers(prev => [...prev, {
      id: Date.now(),
      type: 'endpoint',
      interface: iface,
      membername: displayName || ext,
      penalty: 0,
      paused: 0,
      extension: ext,
    }]);
    setSearchQuery('');
  }, [members]);

  const addCustomMember = useCallback(() => {
    if (!customNumber.trim() || !customContext.trim()) return;
    const iface = `Local/${customNumber.trim()}@${customContext.trim()}`;
    if (members.some(m => m.interface === iface)) return;
    setMembers(prev => [...prev, {
      id: Date.now(),
      type: 'custom',
      interface: iface,
      membername: customNumber.trim(),
      penalty: 0,
      paused: 0,
      extension: customNumber.trim(),
      context: customContext.trim(),
    }]);
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
      .filter((ep: { id?: string; extension?: string; callerid?: string }) => {
        const sipId = String(ep.id || '');
        if (!sipId || isWebrtcCompanion(sipId)) return false;
        const iface = `PJSIP/${sipId}`;
        if (addedInterfaces.has(iface)) return false;
        const ext = (ep.extension || extractExtension(sipId) || '').toLowerCase();
        const callerid = (ep.callerid || '').toLowerCase();
        return ext.includes(q) || callerid.includes(q) || sipId.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }, [searchQuery, endpoints, members]);

  // Submit
  const handleSubmit = async () => {
    const isCreateMode = mode === 'create' || mode === 'copy';
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

    try {
      if (isCreateMode) await createQueue(dto).unwrap();
      else await updateQueue({ name: queueData?.name || '', data: dto }).unwrap();
      handleClose();
    } catch {
      toast.error(t('modal.errors.save'));
    }
  };

  const isLoading = isCreating || isUpdating || isFetching;

  // Helper: Prompt select
  const PromptSelect = ({ value, onChange, label, tooltip }: { value: string; onChange: (v: string) => void; label: string; tooltip?: string }) => (
    <VStack align="stretch" gap="4">
      <HStack gap="4" align="center">
        <Text className={cls.fieldLabel}>{label}</Text>
        {tooltip && <InfoTooltip text={tooltip} />}
      </HStack>
      <Select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cls.control}
      >
        <option value="">{t('queues.defaultPrompt')}</option>
        {prompts.map((p: any) => (
          <option key={p.uid} value={p.filename || p.comment}>{p.comment || p.filename}</option>
        ))}
      </Select>
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
      <VStack align="stretch" gap="4">
        <HStack gap="4" align="center">
          <Text className={cls.fieldLabel}>{label}</Text>
          {tooltip && <InfoTooltip text={tooltip} />}
        </HStack>
        {selected.length > 0 && (
          <VStack align="stretch" max className={cls.flagGrid}>
            {selected.map((file, idx) => (
              <Text key={`${file}-${idx}`} className={cls.promptChip}>
                <Text className={cls.truncate}>{getDisplayName(file)}</Text>
                <Button type="button" className={cls.promptChipRemove} onClick={() => removePrompt(file)}>
                  <X className={cls.icon} />
                </Button>
              </Text>
            ))}
          </VStack>
        )}
        <Select
          value=""
          onChange={e => { addPrompt(e.target.value); e.target.value = ''; }}
          className={cls.control}
        >
          <option value="">{t('queues.addPromptPlaceholder')}</option>
          {prompts.filter((p: any) => !selected.includes(p.filename || p.comment)).map((p: any) => (
            <option key={p.uid} value={p.filename || p.comment}>{p.comment || p.filename}</option>
          ))}
        </Select>
      </VStack>
    );
  };

  // Helper: toggle with description
  const ToggleField = ({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) => (
    <ModalToggle checked={checked} onCheckedChange={onChange} label={label} tooltip={desc} />
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>


        <FormDialogContent size="large" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle >
              {mode === 'edit'
                ? t('queues.editQueue')
                : mode === 'copy'
                  ? t('queues.copyQueue', 'Копировать очередь')
                  : t('queues.createQueue')}
            </DialogTitle>

          </DialogHeader>

          {/* Tabs */}
          <ModalTabs items={[
                { id: 'general', label: t('queues.tabGeneral') },
                { id: 'members', label: `${t('queues.tabMembers')} (${members.length})` },
                { id: 'announcements', label: t('queues.tabAnnouncements') },
                { id: 'advanced', label: t('queues.tabAdvanced') },
                ...(mode === 'edit' && selectedName
                  ? [{ id: 'usage', label: t('references.tab', 'Где используется') }]
                  : []),
              ]} value={activeTab} onChange={(value) => setActiveTab(value as typeof activeTab)} label={t("queues.tabGeneral", t("common.settings"))} />

          <ModalBody>
            {/* ═══════════ GENERAL TAB ═══════════ */}
            {activeTab === 'general' && (
              <ModalSection title={t("modal.sections.identity")}>

                {/* Queue extension */}
                <VStack align="stretch" max className={cls.gridTwo}>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.exten')}</Label>
                      <InfoTooltip text={t('queues.extenDesc')} />
                    </HStack>
                    <Input value={exten} onChange={e => setExten(e.target.value)} placeholder="700" className={cls.mono} />
                  </VStack>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.displayName')}</Label>
                      <InfoTooltip text={t('queues.displayNameDesc')} />
                    </HStack>
                    <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t('queues.displayNamePlaceholder')} />
                  </VStack>
                </VStack>

                {/* Strategy select */}
                <VStack align="stretch" gap="4">
                  <HStack gap="4" align="center">
                    <Label className={cls.fieldLabel}>{t('queues.strategy')}</Label>
                    <InfoTooltip text={`${t('queues.strategyDesc')}\n\n${STRATEGY_VALUES.map(s => `• ${t(`queues.strategy.${s}`)}: ${t(`queues.strategy.${s}Desc`)}`).join('\n')}`} />
                  </HStack>
                  <Select
                    value={strategy}
                    onChange={e => setStrategy(e.target.value)}
                    className={cls.control}
                  >
                    {STRATEGY_VALUES.map(s => (
                      <option key={s} value={s}>{t(`queues.strategy.${s}`)}</option>
                    ))}
                  </Select>
                </VStack>

                {/* Timing row */}
                <VStack align="stretch" max className={cls.gridThree}>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.timeout')}</Label>
                      <InfoTooltip text={t('queues.timeoutDesc')} />
                    </HStack>
                    <Input type="number" value={timeout} onChange={e => setTimeout(e.target.value)} />
                  </VStack>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.retry')}</Label>
                      <InfoTooltip text={t('queues.retryDesc')} />
                    </HStack>
                    <Input type="number" value={retry} onChange={e => setRetry(e.target.value)} />
                  </VStack>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.wrapuptime')}</Label>
                      <InfoTooltip text={t('queues.wrapuptimeDesc')} />
                    </HStack>
                    <Input type="number" value={wrapuptime} onChange={e => setWrapuptime(e.target.value)} />
                  </VStack>
                </VStack>

                {/* Limits row */}
                <VStack align="stretch" max className={cls.gridThree}>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.maxlen')}</Label>
                      <InfoTooltip text={t('queues.maxlenDesc')} />
                    </HStack>
                    <Input type="number" value={maxlen} onChange={e => setMaxlen(e.target.value)} />
                  </VStack>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.weight')}</Label>
                      <InfoTooltip text={t('queues.weightDesc')} />
                    </HStack>
                    <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} />
                  </VStack>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.servicelevel')}</Label>
                      <InfoTooltip text={t('queues.servicelevelDesc')} />
                    </HStack>
                    <Input type="number" value={servicelevel} onChange={e => setServicelevel(e.target.value)} />
                  </VStack>
                </VStack>

                {/* joinempty / leavewhenempty: multi-selects */}
                <VStack align="stretch" gap="4">
                  <HStack gap="4" align="center">
                    <Label className={cls.fieldLabel}>{t('queues.joinempty')}</Label>
                    <InfoTooltip text={t('queues.joinemptyDesc')} />
                  </HStack>
                  <MultiSelect value={joinempty ? joinempty.split(',').filter(Boolean) : []} onChange={(values) => setJoinempty(values.join(','))} options={emptyFlagOptions} placeholder={t('common.select')} />
                </VStack>
                <VStack align="stretch" gap="4">
                  <HStack gap="4" align="center">
                    <Label className={cls.fieldLabel}>{t('queues.leavewhenempty')}</Label>
                    <InfoTooltip text={t('queues.leavewhenemptyDesc')} />
                  </HStack>
                  <MultiSelect value={leavewhenempty ? leavewhenempty.split(',').filter(Boolean) : []} onChange={(values) => setLeavewhenempty(values.join(','))} options={emptyFlagOptions} placeholder={t('common.select')} />
                </VStack>

                {/* MOH & Context */}
                <VStack align="stretch" max className={cls.gridTwo}>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.musiconhold')}</Label>
                      <InfoTooltip text={t('queues.musiconholdDesc')} />
                    </HStack>
                    <Select value={musiconhold} onChange={e => setMusiconhold(e.target.value)} className={cls.control}>
                      <option value="">default</option>
                      {mohClasses.map((m: any) => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </Select>
                  </VStack>
                  <VStack align="stretch" gap="4">
                    <HStack gap="4" align="center">
                      <Label className={cls.fieldLabel}>{t('queues.context')}</Label>
                      <InfoTooltip text={t('queues.contextDesc')} />
                    </HStack>
                    <Select value={context} onChange={e => setContext(e.target.value)} className={cls.control}>
                      <option value="">{t('common.notSelected', 'Не выбрано')}</option>
                      {contexts.map((c: { uid: number; name: string; comment?: string }) => (
                        <option key={c.uid} value={c.name}>
                          {c.comment?.trim() ? `${c.name} (${c.comment.trim()})` : c.name}
                        </option>
                      ))}
                    </Select>
                  </VStack>
                </VStack>

</ModalSection>
            )}

            {/* ═══════════ MEMBERS TAB ═══════════ */}
            {activeTab === 'members' && (
              <ModalSection title={t("modal.sections.identity")}>

                <VStack align="stretch" gap="8">
                  <HStack gap="4" align="center">
                    <Text className={cls.fieldLabel}>{t('queues.addMember')}</Text>
                  </HStack>

                  <SegmentedControl<'endpoint' | 'custom'>
                    ariaLabel={t('queues.addMember')}
                    value={memberMode}
                    onChange={setMemberMode}
                    options={[
                      { value: 'endpoint', label: t('queues.memberEndpoint'), icon: Phone },
                      { value: 'custom', label: t('queues.memberCustom'), icon: Hash },
                    ]}
                  />

                  {memberMode === 'endpoint' && (
                    <VStack align="stretch" gap="4">
                      <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('queues.searchEndpoint')} />
                      {filteredEndpoints.length > 0 && (
                        <VStack align="stretch" gap="2" className={cls.catalogList}>
                          {filteredEndpoints.map((ep: { id: string; extension?: string; callerid?: string }) => {
                            const sipId = ep.id;
                            const ext = ep.extension || extractExtension(sipId) || sipId;
                            const match = (ep.callerid || '').match(/^"(.+?)"/);
                            const displayName = match ? match[1] : ext;
                            return (
                              <Button
                                key={sipId}
                                type="button"
                                className={cls.catalogOption}
                                onClick={() => addEndpointMember(sipId, displayName)}
                              >
                                <Phone className={cls.icon} />
                                <Text className={cls.mono}>{ext}</Text>
                                {displayName !== ext && (
                                  <Text className={cls.muted}>{displayName}</Text>
                                )}
                              </Button>
                            );
                          })}
                        </VStack>
                      )}
                    </VStack>
                  )}

                  {memberMode === 'custom' && (
                    <VStack align="stretch" gap="4">
                      <HStack gap="8">
                        <Input
                          className={cls.control}
                          value={customNumber}
                          onChange={e => setCustomNumber(e.target.value)}
                          placeholder={t('queues.customNumber')}
                          onKeyDown={e => e.key === 'Enter' && addCustomMember()}
                        />
                        <Select
                          value={customContext}
                          onChange={e => setCustomContext(e.target.value)}
                          className={cls.narrowControl}
                        >
                          <option value="">{t('queues.selectContext', 'Выберите контекст')}</option>
                          {contexts.map((c: { uid: number; name: string; comment?: string }) => (
                            <option key={c.uid} value={c.name}>
                              {c.comment?.trim() ? `${c.name} (${c.comment.trim()})` : c.name}
                            </option>
                          ))}
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addCustomMember}
                          disabled={!customNumber.trim() || !customContext.trim()}
                        >
                          +
                        </Button>
                      </HStack>
                    </VStack>
                  )}
                </VStack>

                {members.length > 0 && (
                  <VStack align="stretch" gap="8">
                    <Text className={cls.fieldLabel}>{t('queues.currentMembers')} ({members.length}):</Text>
                    <VStack align="stretch" gap="4">
                      {members.map(m => {
                        const ext = m.extension || (m.type === 'endpoint' ? interfaceToExtension(m.interface) : '');
                        const name = (m.membername || '').trim();
                        const endpointLabel = !name || name === ext
                          ? ext
                          : (name.includes(`(${ext})`) ? name : `${name} (${ext})`);
                        const customLabel = m.context
                          ? `${ext} (${m.context})`
                          : ext;
                        return (
                          <VStack align="stretch" max key={m.id} className={cls.memberRow}>
                            {m.type === 'endpoint' ? <Phone className={cls.memberIcon} /> : <Hash className={cls.icon} />}
                            <Text className={cls.memberInfo}>
                              {m.type === 'endpoint' ? endpointLabel : customLabel}
                            </Text>
                            <HStack gap="4" align="center">
                              <Text className={cls.hintText}>P:</Text>
                              <Input className={cls.penaltyInput} type="number" min={0} value={m.penalty} onChange={e => updateMemberPenalty(m.id, Number(e.target.value) || 0)} />
                              <Button variant="ghost" size="icon" className={cls.iconButton} onClick={() => toggleMemberPause(m.id)} title={m.paused ? t('queues.unpause') : t('queues.pause')}>
                                {m.paused ? <Play className={cls.icon} /> : <Pause className={cls.icon} />}
                              </Button>
                              <Button variant="ghost" size="icon" className={cls.iconButton} onClick={() => removeMember(m.id)}>
                                <Trash2 className={cls.icon} />
                              </Button>
                            </HStack>
                          </VStack>
                        );
                      })}
                    </VStack>
                    <Text className={cls.hintText}>{t('queues.penaltyHint')}</Text>
                  </VStack>
                )}

                {members.length === 0 && (
                  <VStack align="stretch" max className={cls.emptyState}>{t('queues.noMembers')}</VStack>
                )}

</ModalSection>
            )}

            {/* ═══════════ ANNOUNCEMENTS TAB ═══════════ */}
            {activeTab === 'announcements' && (
              <ModalSection title={t("modal.sections.identity")}>

                {/* Section 1: Caller Position & Holdtime */}
                <VStack align="stretch" max className={cls.announcementSection}>
                  <VStack align="stretch" max className={cls.announcementTitle}>
                    <Users className={cls.icon} />
                    {t('queues.callerAnnouncements')}
                  </VStack>
                  <VStack align="stretch" gap="12">
                    <VStack align="stretch" max className={cls.gridThree}>
                      {/* Column 1: Hold Time & Round Seconds */}
                      <VStack align="stretch" gap="6">
                        <VStack align="stretch" gap="4">
                          <HStack gap="4" align="center">
                            <Label className={cls.fieldLabel}>{t('queues.announceHoldtime')}</Label>
                            <InfoTooltip text={t('queues.announceHoldtimeDesc')} />
                          </HStack>
                          <Select value={announceHoldtime} onChange={e => setAnnounceHoldtime(e.target.value)} className={cls.control}>
                            <option value="">{t('common.notSelected', 'Не выбрано')}</option>
                            <option value="yes">{t('common.yes')}</option>
                            <option value="no">{t('common.no')}</option>
                            <option value="once">{t('queues.once')}</option>
                          </Select>
                        </VStack>
                        <VStack align="stretch" gap="4">
                          <HStack gap="4" align="center">
                            <Label className={cls.fieldLabel}>{t('queues.announceRound')}</Label>
                            <InfoTooltip text={t('queues.announceRoundDesc')} />
                          </HStack>
                          <Input type="number" value={announceRoundSeconds} onChange={e => setAnnounceRoundSeconds(e.target.value)} placeholder="10" />
                        </VStack>
                      </VStack>

                      {/* Column 2: Position & Position Limit */}
                      <VStack align="stretch" gap="6">
                        <VStack align="stretch" gap="4">
                          <HStack gap="4" align="center">
                            <Label className={cls.fieldLabel}>{t('queues.announcePosition')}</Label>
                            <InfoTooltip text={t('queues.announcePositionDesc')} />
                          </HStack>
                          <Select value={announcePosition} onChange={e => setAnnouncePosition(e.target.value)} className={cls.control}>
                            <option value="">{t('common.notSelected', 'Не выбрано')}</option>
                            <option value="yes">{t('common.yes')}</option>
                            <option value="no">{t('common.no')}</option>
                            <option value="limit">{t('queues.posLimit')}</option>
                            <option value="more">{t('queues.posMore')}</option>
                          </Select>
                        </VStack>
                        <VStack align="stretch" gap="4">
                          <HStack gap="4" align="center">
                            <Label className={cls.fieldLabel}>{t('queues.announcePositionLimit')}</Label>
                            <InfoTooltip text={t('queues.announcePositionLimitDesc')} />
                          </HStack>
                          <Input type="number" value={announcePositionLimit} onChange={e => setAnnouncePositionLimit(e.target.value)} placeholder="5" />
                        </VStack>
                      </VStack>

                      {/* Column 3: Frequency & Min Frequency */}
                      <VStack align="stretch" gap="6">
                        <VStack align="stretch" gap="4">
                          <HStack gap="4" align="center">
                            <Label className={cls.fieldLabel}>{t('queues.announceFrequency')}</Label>
                            <InfoTooltip text={t('queues.announceFrequencyDesc')} />
                          </HStack>
                          <Input type="number" value={announceFrequency} onChange={e => setAnnounceFrequency(e.target.value)} placeholder="0" />
                        </VStack>
                        <VStack align="stretch" gap="4">
                          <HStack gap="4" align="center">
                            <Label className={cls.fieldLabel}>{t('queues.minAnnounceFrequency')}</Label>
                            <InfoTooltip text={t('queues.minAnnounceFrequencyDesc')} />
                          </HStack>
                          <Input type="number" value={minAnnounceFrequency} onChange={e => setMinAnnounceFrequency(e.target.value)} placeholder="15" />
                        </VStack>
                      </VStack>
                    </VStack>
                  </VStack>
                </VStack>

                {/* Section 2: Periodic announcements */}
                <VStack align="stretch" max className={cls.announcementSection}>
                  <VStack align="stretch" max className={cls.announcementTitle}>
                    <Volume2 className={cls.icon} />
                    {t('queues.periodicAnnouncements')}
                  </VStack>
                  <VStack align="stretch" gap="12">
                    <MultiPromptSelect label={t('queues.periodicAnnounce')} value={periodicAnnounce} onChange={setPeriodicAnnounce} tooltip={t('queues.periodicAnnounceDesc')} />
                    <VStack align="stretch" gap="4">
                      <HStack gap="4" align="center">
                        <Label className={cls.fieldLabel}>{t('queues.periodicFrequency')}</Label>
                        <InfoTooltip text={t('queues.periodicFrequencyDesc')} />
                      </HStack>
                      <Input type="number" value={periodicAnnounceFrequency} onChange={e => setPeriodicAnnounceFrequency(e.target.value)} placeholder="60" />
                    </VStack>
                  </VStack>
                </VStack>

                {/* Section 3: Agent-facing */}
                <VStack align="stretch" max className={cls.announcementSection}>
                  <VStack align="stretch" max className={cls.announcementTitle}>
                    <Headphones className={cls.icon} />
                    {t('queues.agentAnnouncements')}
                  </VStack>
                  <VStack align="stretch" gap="12">
                    <PromptSelect label={t('queues.announce')} value={announce} onChange={setAnnounce} tooltip={t('queues.announceDesc')} />
                    <ToggleField checked={reportholdtime} onChange={setReportholdtime} label={t('queues.reportholdtime')} desc={t('queues.reportholdtimeDesc')} />
                    <VStack align="stretch" gap="4">
                      <HStack gap="4" align="center">
                        <Label className={cls.fieldLabel}>{t('queues.memberdelay')}</Label>
                        <InfoTooltip text={t('queues.memberdelayDesc')} />
                      </HStack>
                      <Input type="number" value={memberdelay} onChange={e => setMemberdelay(e.target.value)} placeholder="0" />
                    </VStack>
                  </VStack>
                </VStack>

                {/* Section 4: Sound file overrides */}
                <VStack align="stretch" max className={cls.announcementSection}>
                  <VStack align="stretch" max className={cls.announcementTitle}>
                    <Volume2 className={cls.icon} />
                    {t('queues.soundOverrides')}
                  </VStack>
                  <VStack align="stretch" gap="12">
                    <PromptSelect label={t('queues.youarenext')} value={queueYouarenext} onChange={setQueueYouarenext} tooltip={t('queues.youarenextDesc')} />
                    <PromptSelect label={t('queues.thereare')} value={queueThereare} onChange={setQueueThereare} tooltip={t('queues.thereareDesc')} />
                    <PromptSelect label={t('queues.callswaiting')} value={queueCallswaiting} onChange={setQueueCallswaiting} />
                    <PromptSelect label={t('queues.holdtimeSound')} value={queueHoldtime} onChange={setQueueHoldtime} />
                    <PromptSelect label={t('queues.minutesSound')} value={queueMinutes} onChange={setQueueMinutes} />
                    <PromptSelect label={t('queues.secondsSound')} value={queueSeconds} onChange={setQueueSeconds} />
                    <PromptSelect label={t('queues.lessthan')} value={queueLessthan} onChange={setQueueLessthan} />
                    <PromptSelect label={t('queues.thankyou')} value={queueThankyou} onChange={setQueueThankyou} />
                  </VStack>
                </VStack>

</ModalSection>
            )}

            {/* ═══════════ ADVANCED TAB ═══════════ */}
            {activeTab === 'usage' && mode === 'edit' && selectedName && (
              <UsageTab kind="queue" uid={selectedName} />
            )}

            {activeTab === 'advanced' && (
              <ModalSection title={t("modal.sections.settings")}>

                {/* Toggles moved from General */}
                <VStack align="stretch" gap="8">
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

</ModalSection>
            )}
          </ModalBody>

          {/* Actions */}
          <DialogFooter>
            {mode === 'edit' && selectedName && (
              <Tooltip content={deleteHint}>
                <Text>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleteBlocked || isDeleting || isLoading}
                    data-testid="queue-delete"
                    onClick={() => {
                      setConflictRefs([]);
                      setDeleteOpen(true);
                    }}
                  >
                    {t('common.delete', 'Удалить')}
                  </Button>
                </Text>
              </Tooltip>
            )}
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={isLoading || !exten.trim()}>
              {isLoading ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </FormDialogContent>
      {mode === 'edit' && selectedName && (
        <DeleteBlockedDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          entityName={displayName || selectedName}
          references={usageRefs}
          onConfirm={() => void handleDelete()}
          isDeleting={isDeleting}
        />
      )}

    </Dialog>
  );
};
