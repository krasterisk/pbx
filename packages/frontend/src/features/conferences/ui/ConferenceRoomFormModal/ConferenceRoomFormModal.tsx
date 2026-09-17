import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  InfoTooltip,
  Input,
  Label,
  MultiSelect,
  PasswordInput,
  Select,
  Skeleton,
  Switch,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import {
  useCreateConferenceGuestTokenMutation,
  useCreateConferenceRoomMutation,
  useGetConferenceCapacityQuery,
  useGetConferenceGuestTokensQuery,
  useGetConferenceModeratorsQuery,
  useGetConferenceRoomQuery,
  useRevokeConferenceGuestTokenMutation,
  useSetConferenceModeratorsMutation,
  useUpdateConferenceRoomMutation,
  type ConferenceEntryStrictness,
  type ConferenceGuestLink,
  type ConferenceInviteScope,
  type ConferenceRecordMode,
  type ConferenceRoomKind,
  type ConferenceRoomModerator,
  type ConferenceRoomWrite,
} from '@/shared/api/endpoints/conferenceRoomApi';
import { useGetEndpointsQuery } from '@/shared/api/endpoints/endpointApi';
import { useGetMohClassesQuery } from '@/shared/api/endpoints/mohApi';
import {
  conferencesPageActions,
  selectConferencesIsModalOpen,
  selectConferencesModalMode,
  selectConferencesSelectedUid,
} from '../../model/slice/conferencesPageSlice';
import { ConferenceHistoryTab } from '../ConferenceHistoryTab';
import cls from './ConferenceRoomFormModal.module.scss';

type TabId = 'general' | 'access' | 'roles' | 'record' | 'links' | 'history';

const DEFAULT_WRITE: Required<Pick<
  ConferenceRoomWrite,
  | 'kind'
  | 'entry_strictness'
  | 'wait_marked'
  | 'end_marked'
  | 'record_mode'
  | 'notify_recording'
  | 'invite_external_scope'
  | 'announce_join_leave'
>> = {
  kind: 'permanent',
  entry_strictness: 'token_name',
  wait_marked: false,
  end_marked: false,
  record_mode: 'off',
  notify_recording: true,
  invite_external_scope: 'owner',
  announce_join_leave: false,
};

const EMPTY_LINKS: ConferenceGuestLink[] = [];
const EMPTY_MODERATORS: ConferenceRoomModerator[] = [];

export const ConferenceRoomFormModal = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectConferencesIsModalOpen);
  const mode = useAppSelector(selectConferencesModalMode);
  const selectedUid = useAppSelector(selectConferencesSelectedUid);
  const isEdit = mode === 'edit';
  const needsRoom = (mode === 'edit' || mode === 'copy') && selectedUid != null;

  const { data: room, isFetching } = useGetConferenceRoomQuery(selectedUid!, {
    skip: !needsRoom,
  });
  const { data: capacity } = useGetConferenceCapacityQuery(selectedUid!, {
    skip: !needsRoom,
  });
  const { data: linksData } = useGetConferenceGuestTokensQuery(selectedUid!, {
    skip: !isEdit || selectedUid == null,
  });
  const { data: moderatorsData } = useGetConferenceModeratorsQuery(selectedUid!, {
    skip: !needsRoom,
  });
  const links = linksData ?? EMPTY_LINKS;
  const moderators = moderatorsData ?? EMPTY_MODERATORS;
  const { data: endpoints = [] } = useGetEndpointsQuery(undefined, { skip: !isOpen });
  const { data: mohClasses = [] } = useGetMohClassesQuery(undefined, { skip: !isOpen });
  const [createRoom, { isLoading: isCreating }] = useCreateConferenceRoomMutation();
  const [updateRoom, { isLoading: isUpdating }] = useUpdateConferenceRoomMutation();
  const [createLink] = useCreateConferenceGuestTokenMutation();
  const [revokeLink] = useRevokeConferenceGuestTokenMutation();
  const [setModerators] = useSetConferenceModeratorsMutation();

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ConferenceRoomKind>(DEFAULT_WRITE.kind);
  const [entryStrictness, setEntryStrictness] = useState<ConferenceEntryStrictness>(
    DEFAULT_WRITE.entry_strictness,
  );
  const [pin, setPin] = useState('');
  const [waitMarked, setWaitMarked] = useState(DEFAULT_WRITE.wait_marked);
  const [endMarked, setEndMarked] = useState(DEFAULT_WRITE.end_marked);
  const [recordMode, setRecordMode] = useState<ConferenceRecordMode>(DEFAULT_WRITE.record_mode);
  const [notifyRecording, setNotifyRecording] = useState(DEFAULT_WRITE.notify_recording);
  const [inviteScope, setInviteScope] = useState<ConferenceInviteScope>(
    DEFAULT_WRITE.invite_external_scope,
  );
  const [musiconhold, setMusiconhold] = useState('');
  const [announceJoinLeave, setAnnounceJoinLeave] = useState(DEFAULT_WRITE.announce_join_leave);
  const [moderatorRefs, setModeratorRefs] = useState<string[]>([]);
  const [pendingRevoke, setPendingRevoke] = useState<{ uid: number; name: string } | null>(null);

  const tabs = useMemo(() => {
    const base: { id: TabId; label: string }[] = [
      { id: 'general', label: t('conferences.tabGeneral', 'Основные') },
      { id: 'access', label: t('conferences.tabAccess', 'Доступ') },
      { id: 'roles', label: t('conferences.tabRoles', 'Роли') },
      { id: 'record', label: t('conferences.tabRecord', 'Запись') },
    ];
    if (isEdit) {
      base.push(
        { id: 'links', label: t('conferences.tabLinks', 'Ссылки') },
        { id: 'history', label: t('conferences.tabHistory', 'История встреч') },
      );
    }
    return base;
  }, [isEdit, t]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('general');
    if (needsRoom && room) {
      setNumber(mode === 'copy' ? '' : room.number);
      setName(mode === 'copy' ? '' : room.name);
      setKind(room.kind ?? DEFAULT_WRITE.kind);
      setEntryStrictness(room.entry_strictness ?? DEFAULT_WRITE.entry_strictness);
      setPin(room.pin ?? '');
      setWaitMarked(room.wait_marked ?? DEFAULT_WRITE.wait_marked);
      setEndMarked(room.end_marked ?? DEFAULT_WRITE.end_marked);
      setRecordMode(room.record_mode ?? DEFAULT_WRITE.record_mode);
      setNotifyRecording(room.notify_recording ?? DEFAULT_WRITE.notify_recording);
      setInviteScope(room.invite_external_scope ?? DEFAULT_WRITE.invite_external_scope);
      setMusiconhold(room.musiconhold ?? '');
      setAnnounceJoinLeave(room.announce_join_leave ?? DEFAULT_WRITE.announce_join_leave);
      setModeratorRefs(moderators.map((row) => row.endpointRef));
    } else if (mode === 'create') {
      setNumber('');
      setName('');
      setKind(DEFAULT_WRITE.kind);
      setEntryStrictness(DEFAULT_WRITE.entry_strictness);
      setPin('');
      setWaitMarked(DEFAULT_WRITE.wait_marked);
      setEndMarked(DEFAULT_WRITE.end_marked);
      setRecordMode(DEFAULT_WRITE.record_mode);
      setNotifyRecording(DEFAULT_WRITE.notify_recording);
      setInviteScope(DEFAULT_WRITE.invite_external_scope);
      setMusiconhold('');
      setAnnounceJoinLeave(DEFAULT_WRITE.announce_join_leave);
      setModeratorRefs([]);
    }
  }, [isOpen, mode, needsRoom, room, moderatorsData]);

  const close = () => dispatch(conferencesPageActions.closeModal());

  const title = useMemo(() => {
    if (mode === 'edit') return t('conferences.editRoom', 'Редактировать комнату');
    if (mode === 'copy') return t('conferences.copyRoom', 'Копировать комнату');
    return t('conferences.createRoom', 'Создать комнату');
  }, [mode, t]);

  const maxMembers = capacity?.maxParticipants ?? 0;
  const endpointOptions = endpoints.map((row) => ({
    value: row.extension,
    label: row.callerid || row.extension,
  }));

  const payload = (): ConferenceRoomWrite => ({
    number,
    name,
    kind,
    entry_strictness: entryStrictness,
    pin: pin || null,
    wait_marked: waitMarked,
    end_marked: endMarked,
    record_mode: recordMode,
    notify_recording: notifyRecording,
    invite_external_scope: inviteScope,
    musiconhold: musiconhold || null,
    announce_join_leave: announceJoinLeave,
  });

  const persistModerators = async (uid: number) => {
    await setModerators({
      uid,
      moderators: moderatorRefs.map((endpointRef) => ({ endpointRef, role: 'moderator' as const })),
    }).unwrap();
  };

  const onSubmit = async () => {
    try {
      if (mode === 'edit' && selectedUid != null) {
        await updateRoom({ uid: selectedUid, data: payload() }).unwrap();
        await persistModerators(selectedUid);
      } else {
        const created = await createRoom(payload()).unwrap();
        if (moderatorRefs.length) await persistModerators(created.uid);
      }
      close();
    } catch {
      toast.error(t('conferences.saveFailed', 'Не удалось сохранить комнату'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle className={cls.title}>{title}</DialogTitle>
          <DialogDescription className={cls.srOnly}>{title}</DialogDescription>
        </DialogHeader>

        <div className={cls.tabsWrap}>
          <div className={cls.tabsRow} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? cls.tabActive : cls.tab}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className={cls.scrollBody}>
          {needsRoom && isFetching ? (
            <VStack gap="8" max>
              <Skeleton className={cls.empty} />
              <Skeleton className={cls.empty} />
            </VStack>
          ) : null}

          {activeTab === 'general' && !isFetching ? (
            <VStack gap="16" max>
              <div className={cls.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="conference-room-number">{t('conferences.number', 'Номер комнаты')}</Label>
                  <InfoTooltip text={t('conferences.numberHint')} />
                </HStack>
                <Input
                  id="conference-room-number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  inputMode="numeric"
                  maxLength={32}
                />
              </div>
              <div className={cls.field}>
                <Label htmlFor="conference-room-name">{t('conferences.name', 'Название')}</Label>
                <Input
                  id="conference-room-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('conferences.namePlaceholder')}
                  maxLength={255}
                />
              </div>
              <div className={cls.field}>
                <Label htmlFor="conference-room-kind">{t('conferences.kind', 'Тип')}</Label>
                <Select
                  id="conference-room-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ConferenceRoomKind)}
                >
                  <option value="permanent">{t('conferences.kindPermanent', 'Постоянная')}</option>
                  <option value="ephemeral">{t('conferences.kindEphemeral', 'Разовая')}</option>
                </Select>
              </div>
              <div className={cls.field}>
                <Label htmlFor="conference-room-moh">{t('callGroups.mohClass', 'Музыка ожидания')}</Label>
                <Select
                  id="conference-room-moh"
                  value={musiconhold}
                  onChange={(e) => setMusiconhold(e.target.value)}
                >
                  <option value="">{t('common.none', 'Нет')}</option>
                  {mohClasses.map((row) => (
                    <option key={row.name} value={row.name}>
                      {row.displayName || row.name}
                    </option>
                  ))}
                </Select>
              </div>
              <HStack gap="8" align="center">
                <Switch
                  id="conference-room-announce"
                  checked={announceJoinLeave}
                  onCheckedChange={setAnnounceJoinLeave}
                />
                <Label htmlFor="conference-room-announce">
                  {t('conferences.announceJoinLeave', 'Объявлять вход и выход')}
                </Label>
              </HStack>
              <HStack gap="4" align="center">
                <Text variant="muted">{t('conferences.maxMembers', { count: maxMembers })}</Text>
                <InfoTooltip text={t('conferences.maxMembersHint')} />
              </HStack>
            </VStack>
          ) : null}

          {activeTab === 'access' && !isFetching ? (
            <VStack gap="16" max>
              <div className={cls.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="conference-room-strictness">{t('conferences.strictness', 'Строгость входа')}</Label>
                  <InfoTooltip text={t('conferences.strictnessHint')} />
                </HStack>
                <Select
                  id="conference-room-strictness"
                  value={entryStrictness}
                  onChange={(e) => setEntryStrictness(e.target.value as ConferenceEntryStrictness)}
                >
                  <option value="token_name">{t('conferences.strictnessName', 'Ссылка и имя')}</option>
                  <option value="token_name_pin">{t('conferences.strictnessPin', 'Ссылка, имя и PIN')}</option>
                  <option value="token_name_pin_moderator">
                    {t('conferences.strictnessModerator', 'Одобрение модератором')}
                  </option>
                </Select>
              </div>
              <div className={cls.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="conference-room-pin">{t('conferences.pin', 'PIN комнаты')}</Label>
                  <InfoTooltip text={t('conferences.pinHint')} />
                </HStack>
                <PasswordInput
                  id="conference-room-pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  maxLength={64}
                />
              </div>
              <div className={cls.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="conference-room-wait">{t('conferences.beforeHost', 'Пока модератора нет')}</Label>
                  <InfoTooltip text={t('conferences.beforeHostHint')} />
                </HStack>
                <Switch id="conference-room-wait" checked={waitMarked} onCheckedChange={setWaitMarked} />
              </div>
              <HStack gap="8" align="center">
                <Switch id="conference-room-end" checked={endMarked} onCheckedChange={setEndMarked} />
                <Label htmlFor="conference-room-end">{t('conferences.endWithHost')}</Label>
              </HStack>
              <div className={cls.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="conference-room-invite">{t('conferences.access.inviteExternal')}</Label>
                  <InfoTooltip
                    text={`${t('conferences.access.inviteScopeOwner')} - ${t('conferences.access.inviteExternal')}`}
                  />
                </HStack>
                <Select
                  id="conference-room-invite"
                  value={inviteScope}
                  onChange={(e) => setInviteScope(e.target.value as ConferenceInviteScope)}
                >
                  <option value="owner">{t('conferences.access.inviteScopeOwner')}</option>
                  <option value="moderator">{t('conferences.access.inviteScopeModerator')}</option>
                  <option value="anyone">{t('conferences.access.inviteScopeAnyone')}</option>
                </Select>
              </div>
            </VStack>
          ) : null}

          {activeTab === 'roles' && !isFetching ? (
            <VStack gap="16" max>
              <div className={cls.field}>
                <HStack gap="4" align="center">
                  <Label>{t('conferences.tabRoles', 'Роли')}</Label>
                  <InfoTooltip
                    text={`${t('conferences.live.roleModerator')} - ${t('conferences.tabRoles', 'Роли')}`}
                  />
                </HStack>
                <MultiSelect
                  value={moderatorRefs}
                  onChange={setModeratorRefs}
                  options={endpointOptions}
                  searchable
                />
              </div>
            </VStack>
          ) : null}

          {activeTab === 'record' && !isFetching ? (
            <VStack gap="16" max>
              <div className={cls.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="conference-room-record">{t('conferences.tabRecord', 'Запись')}</Label>
                  <InfoTooltip
                    text={`${t('conferences.recordAuto', 'Авто')} - ${t('conferences.live.recordStart')}\n${t('conferences.recordButton', 'По кнопке')} - ${t('conferences.live.recordStop')}`}
                  />
                </HStack>
                <Select
                  id="conference-room-record"
                  value={recordMode}
                  onChange={(e) => setRecordMode(e.target.value as ConferenceRecordMode)}
                >
                  <option value="off">{t('conferences.recordOff', 'Выключена')}</option>
                  <option value="auto">{t('conferences.recordAuto', 'Авто')}</option>
                  <option value="button">{t('conferences.recordButton', 'По кнопке')}</option>
                  <option value="both">{t('conferences.recordBoth', 'Авто и по кнопке')}</option>
                </Select>
              </div>
              <HStack gap="8" align="center">
                <Switch
                  id="conference-room-notify"
                  checked={notifyRecording}
                  onCheckedChange={setNotifyRecording}
                />
                <Label htmlFor="conference-room-notify">{t('conferences.live.recordNotice')}</Label>
              </HStack>
            </VStack>
          ) : null}

          {activeTab === 'links' && isEdit && selectedUid != null ? (
            <VStack gap="16" max>
              {links.length === 0 ? (
                <VStack gap="12" align="center" className={cls.empty}>
                  <Text>{t('conferences.links.noLinks')}</Text>
                  <Text variant="muted">{t('conferences.links.noLinksHint')}</Text>
                  <Button
                    type="button"
                    onClick={() => void createLink({ uid: selectedUid, kind: 'shared_link' })}
                  >
                    {t('conferences.links.create')}
                  </Button>
                </VStack>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={() => void createLink({ uid: selectedUid, kind: 'shared_link' })}
                  >
                    {t('conferences.links.create')}
                  </Button>
                  {links.map((link) => {
                    const label = link.invite_name || t('conferences.links.shared');
                    return (
                      <HStack key={link.uid} justify="between" align="center" max className={cls.linkRow}>
                        <VStack gap="4">
                          <Text>{label}</Text>
                          {link.expires_at ? (
                            <Text variant="muted">
                              {t('conferences.links.expires', { date: link.expires_at })}
                            </Text>
                          ) : null}
                        </VStack>
                        <HStack gap="8">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const url = `${window.location.origin}/conf/${link.token}`;
                              void navigator.clipboard?.writeText(url);
                              toast.success(t('conferences.links.copied'));
                            }}
                          >
                            {t('conferences.links.copy')}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setPendingRevoke({ uid: link.uid, name: label })}
                          >
                            {t('conferences.links.revoke')}
                          </Button>
                        </HStack>
                      </HStack>
                    );
                  })}
                </>
              )}
            </VStack>
          ) : null}

          {activeTab === 'history' && isEdit && selectedUid != null ? (
            <ConferenceHistoryTab roomUid={selectedUid} />
          ) : null}
        </div>

        <DialogFooter className={cls.footer}>
          <Button type="button" variant="outline" onClick={close}>
            {t('conferences.closeRoomForm', 'Закрыть без сохранения')}
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={isCreating || isUpdating}>
            {mode === 'edit' || mode === 'copy'
              ? t('conferences.saveRoom', 'Сохранить комнату')
              : t('conferences.createRoom', 'Создать комнату')}
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={Boolean(pendingRevoke)} onOpenChange={(open) => !open && setPendingRevoke(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('conferences.links.confirmRevoke', { name: pendingRevoke?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>{t('conferences.links.confirmRevokeBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRevoke(null)}>
              {t('conferences.links.confirmRevokeKeep')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingRevoke || selectedUid == null) return;
                void revokeLink({ uid: selectedUid, tokenUid: pendingRevoke.uid });
                setPendingRevoke(null);
                toast.success(t('conferences.links.revoked'));
              }}
            >
              {t('conferences.links.confirmRevokeConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
});

ConferenceRoomFormModal.displayName = 'ConferenceRoomFormModal';
