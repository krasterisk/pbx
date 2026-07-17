import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  Text,
  InfoTooltip,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { selectCurrentUser } from '@/entities/User';
import {
  selectCallGroupsIsModalOpen,
  selectCallGroupsModalMode,
  selectCallGroupsSelectedUid,
} from '../../model/selectors/callGroupsPageSelectors';
import { callGroupsPageActions } from '../../model/slice/callGroupsPageSlice';
import {
  useGetCallGroupQuery,
  useCreateCallGroupMutation,
  useUpdateCallGroupMutation,
} from '@/shared/api/endpoints/callGroupApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import type { ICallGroup, RingStrategy } from '@krasterisk/shared';
import { CallGroupMembersEditor, type LocalCallGroupMember } from './CallGroupMembersEditor';
import cls from './CallGroupFormModal.module.scss';

const STRATEGY_VALUES: RingStrategy[] = ['ringall', 'hunt', 'memoryhunt', 'random'];

/** Group-level ring_time is used by ringall and by the "rest together" step of random. */
function usesGroupRingTime(strategy: RingStrategy): boolean {
  return strategy === 'ringall' || strategy === 'random';
}

export interface CallGroupFormModalProps {
  /** Called after a successful create/update so inline hosts (e.g. GroupApp) can select the uid. */
  onSaved?: (group: ICallGroup) => void;
}

export const CallGroupFormModal = memo(({ onSaved }: CallGroupFormModalProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectCallGroupsIsModalOpen);
  const mode = useAppSelector(selectCallGroupsModalMode);
  const selectedUid = useAppSelector(selectCallGroupsSelectedUid);
  const currentUser = useAppSelector(selectCurrentUser);
  const vpbxUserUid = currentUser?.vpbx_user_uid ?? 0;
  const defaultContext = `ctx-${vpbxUserUid}`;

  const { data: groupData, isFetching } = useGetCallGroupQuery(selectedUid!, {
    skip: !selectedUid || mode === 'create',
  });
  const [createCallGroup, { isLoading: isCreating }] = useCreateCallGroupMutation();
  const [updateCallGroup, { isLoading: isUpdating }] = useUpdateCallGroupMutation();
  const { data: contexts = [] } = useGetContextsQuery(undefined, { skip: !isOpen });

  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState<RingStrategy>('ringall');
  const [ringTime, setRingTime] = useState('30');
  const [externalContext, setExternalContext] = useState(defaultContext);
  const [cidPrefix, setCidPrefix] = useState('');
  const [members, setMembers] = useState<LocalCallGroupMember[]>([]);
  const [submitError, setSubmitError] = useState('');

  const modalTitle = useMemo(() => {
    if (mode === 'edit') return t('callGroups.edit', 'Редактировать группу');
    if (mode === 'copy') return t('callGroups.copy', 'Копировать группу');
    return t('callGroups.create', 'Создать группу');
  }, [mode, t]);

  const showGroupRingTime = usesGroupRingTime(strategy);

  useEffect(() => {
    if (!isOpen) return;

    if ((mode === 'edit' || mode === 'copy') && groupData) {
      setName(mode === 'copy' ? `${groupData.name} (${t('common.copy', 'копия')})` : groupData.name);
      setStrategy(groupData.strategy || 'ringall');
      setRingTime(String(groupData.ring_time ?? 30));
      setExternalContext(groupData.external_context || defaultContext);
      setCidPrefix(groupData.cid_prefix || '');
      const loadedMembers: LocalCallGroupMember[] = [...(groupData.members || [])]
        .sort((a, b) => a.position - b.position)
        .map((m, idx) => ({
          id: Date.now() + idx,
          member_type: m.member_type,
          value: m.value,
          ring_time: String(m.ring_time ?? ''),
        }));
      setMembers(loadedMembers);
    } else if (mode === 'create') {
      setName('');
      setStrategy('ringall');
      setRingTime('30');
      setExternalContext(defaultContext);
      setCidPrefix('');
      setMembers([]);
    }
    setSubmitError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens or source data changes
  }, [isOpen, mode, groupData, defaultContext]);

  const handleClose = useCallback(() => {
    dispatch(callGroupsPageActions.closeModal());
  }, [dispatch]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (members.length === 0) {
      setSubmitError(t('callGroups.noMembers', 'Добавьте хотя бы одного участника'));
      return;
    }

    const payload = {
      name: trimmedName,
      strategy,
      ring_time: Number(ringTime) || undefined,
      external_context: externalContext.trim() || defaultContext,
      cid_prefix: cidPrefix.trim() || undefined,
      members: members.map((m, index) => ({
        member_type: m.member_type,
        value: m.value.trim(),
        position: index,
        ring_time: m.ring_time ? Number(m.ring_time) : undefined,
      })),
    };

    try {
      let saved: ICallGroup;
      if (mode === 'edit' && selectedUid) {
        saved = await updateCallGroup({ uid: selectedUid, data: payload }).unwrap();
      } else {
        saved = await createCallGroup(payload).unwrap();
      }
      onSaved?.(saved);
      handleClose();
    } catch {
      setSubmitError(t('common.error', 'Ошибка сохранения'));
    }
  }, [
    name,
    members,
    strategy,
    ringTime,
    externalContext,
    cidPrefix,
    defaultContext,
    mode,
    selectedUid,
    createCallGroup,
    updateCallGroup,
    onSaved,
    handleClose,
    t,
  ]);

  const isSaving = isCreating || isUpdating || isFetching;

  const ringTimeHint =
    strategy === 'random'
      ? t('callGroups.ringTimeDescRandom')
      : t('callGroups.ringTimeDescRingall');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="2xl" className={cls.dialogContent}>
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
        </DialogHeader>

        <form className={cls.form} onSubmit={handleSubmit}>
          <VStack gap="12" max>
            <div className={cls.field}>
              <HStack gap="4" align="center">
                <Label htmlFor="call-group-name">{t('callGroups.name', 'Название')}</Label>
                <InfoTooltip text={t('callGroups.nameDesc')} />
              </HStack>
              <Input
                id="call-group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={cls.fieldRow}>
              <div className={cls.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="call-group-strategy">{t('callGroups.strategy', 'Стратегия')}</Label>
                  <InfoTooltip
                    text={`${t('callGroups.strategyDesc')}\n\n• ${t('callGroups.strategy.ringall')}: ${t('callGroups.strategy.ringallDesc')}\n• ${t('callGroups.strategy.hunt')}: ${t('callGroups.strategy.huntDesc')}\n• ${t('callGroups.strategy.memoryhunt')}: ${t('callGroups.strategy.memoryhuntDesc')}\n• ${t('callGroups.strategy.random')}: ${t('callGroups.strategy.randomDesc')}`}
                  />
                </HStack>
                <Select
                  id="call-group-strategy"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as RingStrategy)}
                >
                  {STRATEGY_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {t(`callGroups.strategy.${s}`, s)}
                    </option>
                  ))}
                </Select>
              </div>

              {showGroupRingTime && (
                <div className={cls.field}>
                  <HStack gap="4" align="center">
                    <Label htmlFor="call-group-ring-time">{t('callGroups.ringTime', 'Время звонка (сек)')}</Label>
                    <InfoTooltip text={ringTimeHint} />
                  </HStack>
                  <Input
                    id="call-group-ring-time"
                    type="number"
                    min={0}
                    value={ringTime}
                    onChange={(e) => setRingTime(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className={cls.field}>
              <HStack gap="4" align="center">
                <Label htmlFor="call-group-cid-prefix">{t('callGroups.cidPrefix', 'Префикс Caller ID')}</Label>
                <InfoTooltip text={t('callGroups.cidPrefixDesc')} />
              </HStack>
              <Input
                id="call-group-cid-prefix"
                value={cidPrefix}
                onChange={(e) => setCidPrefix(e.target.value)}
                placeholder={t('callGroups.cidPrefix', 'Префикс Caller ID')}
              />
            </div>

            <CallGroupMembersEditor
              members={members}
              setMembers={setMembers}
              strategy={strategy}
              externalContext={externalContext}
              onExternalContextChange={setExternalContext}
              contexts={contexts.map((c) => ({ uid: c.uid, name: c.name }))}
            />

            {submitError && (
              <Text variant="small" className={cls.errorText}>{submitError}</Text>
            )}
          </VStack>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel', 'Отмена')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {t('common.save', 'Сохранить')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});

CallGroupFormModal.displayName = 'CallGroupFormModal';
