import { PasswordInput } from '@/shared/ui';
import { toast } from 'react-toastify';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Key, Globe } from 'lucide-react';
import { Button, Input, InfoTooltip, Dialog, FormDialogContent, DialogHeader, DialogTitle, DialogFooter, ModalBody, ModalSection, ModalTabs, Label, Text, Select } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  selectTrunkIsModalOpen,
  selectSelectedTrunk,
  selectTrunkModalMode,
} from '../../model/selectors/trunksPageSelectors';
import { trunksPageActions } from '../../model/slice/trunksPageSlice';
import {
  useCreateTrunkMutation,
  useUpdateTrunkMutation,
} from '@/shared/api/endpoints/trunkApi';
import { rtkApi } from '@/shared/api/rtkApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useDefaultContext } from '@/shared/lib/useDefaultContext';
import { ADVANCED_PJSIP_FIELDS } from '@/shared/config/pjsipAdvancedFields';
import { PjsipSettingsBuilder as AdvancedSettingsBuilder } from '@/shared/ui/PjsipSettingsBuilder';

import cls from './TrunkFormModal.module.scss';

const CODEC_OPTIONS = [
  'ulaw', 'alaw', 'g722', 'g729', 'gsm', 'opus',
];

const TRANSPORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'transport-udp', label: 'UDP' },
  { value: 'transport-tcp', label: 'TCP' },
  { value: 'transport-tls', label: 'TLS' },
];

const parseOptionalInt = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : undefined;
};

export const TrunkFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectTrunkIsModalOpen);
  const selected = useAppSelector(selectSelectedTrunk);
  const mode = useAppSelector(selectTrunkModalMode);

  const [createTrunk, { isLoading: isCreating }] = useCreateTrunkMutation();
  const [updateTrunk, { isLoading: isUpdating }] = useUpdateTrunkMutation();
  const { data: contexts = [] } = useGetContextsQuery();
  const delayedRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup delayed refetch timer on unmount
  useEffect(() => {
    return () => {
      if (delayedRefetchTimerRef.current) {
        clearTimeout(delayedRefetchTimerRef.current);
      }
    };
  }, []);

  /** Schedule a delayed refetch so the registration status updates without polling */
  const scheduleDelayedRefetch = useCallback(() => {
    if (delayedRefetchTimerRef.current) {
      clearTimeout(delayedRefetchTimerRef.current);
    }
    delayedRefetchTimerRef.current = setTimeout(() => {
      dispatch(rtkApi.util.invalidateTags([{ type: 'Trunks', id: 'LIST' }]));
    }, 5000);
  }, [dispatch]);

  const [activeTab, setActiveTab] = useState<'basic' | 'auth' | 'network' | 'advanced'>('basic');

  // Form state
  const [name, setName] = useState('');
  const [trunkType, setTrunkType] = useState<'auth' | 'ip'>('auth');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [context, setContext] = useState('');
  const [transport, setTransport] = useState('');
  const [codecs, setCodecs] = useState<string[]>(['ulaw', 'alaw', 'g722']);
  const [fromUser, setFromUser] = useState('');
  const [fromDomain, setFromDomain] = useState('');
  const [contactUser, setContactUser] = useState('');
  const [matchIp, setMatchIp] = useState('');
  const [qualifyFrequency, setQualifyFrequency] = useState('');
  const [registrationExpiration, setRegistrationExpiration] = useState('');
  const [maxChannels, setMaxChannels] = useState('');
  const [advancedState, setAdvancedState] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) setActiveTab('basic');

    if ((mode === 'edit' || mode === 'copy') && selected) {
      setName(mode === 'copy' ? '' : (selected.name || ''));
      setTrunkType(selected.trunkType || 'auth');
      setHost(selected.host || '');
      setPort('');
      setUsername(selected.username || '');
      setPassword('');
      setContext(selected.context || '');
      setTransport(selected.transport || '');
      setCodecs((selected.codecs || 'ulaw,alaw,g722').split(',').map((s: string) => s.trim()));
      setFromUser(selected.fromUser || '');
      setFromDomain(selected.fromDomain || '');
      setContactUser(selected.contactUser || '');
      setMatchIp(selected.matchIp || '');
      setQualifyFrequency(
        selected.qualifyFrequency != null ? String(selected.qualifyFrequency) : '120',
      );
      setRegistrationExpiration(
        selected.registrationExpiration != null ? String(selected.registrationExpiration) : '600',
      );
      setMaxChannels(
        selected.maxChannels && selected.maxChannels > 0 ? String(selected.maxChannels) : '',
      );

      const initAdv: Record<string, string> = {};
      ADVANCED_PJSIP_FIELDS.forEach((key) => {
        if (key === 'from_domain' || key === 'from_user' || key === 'contact_user') return;
        if (key === 'device_state_busy_at') return;
        const val = (selected as any)?.endpoint?.[key] ?? (selected as any)?.[key];
        if (val !== undefined && val !== null && val !== '') {
          initAdv[key] = String(val);
        }
      });
      setAdvancedState(initAdv);
    } else {
      setName('');
      setTrunkType('auth');
      setHost('');
      setPort('');
      setUsername('');
      setPassword('');
      setContext('');
      setTransport('');
      setCodecs(['ulaw', 'alaw', 'g722']);
      setFromUser('');
      setFromDomain('');
      setContactUser('');
      setMatchIp('');
      setQualifyFrequency('120');
      setRegistrationExpiration('600');
      setMaxChannels('');
      setAdvancedState({});
    }
  }, [mode, selected, isOpen]);

  const chooseContext = useDefaultContext(isOpen, mode === 'create', contexts, 'trunks', setContext);

  const handleClose = useCallback(() => {
    dispatch(trunksPageActions.closeModal());
  }, [dispatch]);

  const isCreateMode = mode === 'create' || mode === 'copy';

  const handleSubmit = async () => {
    if (!context.trim()) { setActiveTab('basic'); return; }
    try {
      if (isCreateMode) {
        await createTrunk({
          name,
          trunkType,
          host,
          port: port ? parseInt(port, 10) : undefined,
          username: username || undefined,
          password: password || undefined,
          context: context || undefined,
          transport: transport || undefined,
          codecs: codecs.join(','),
          fromUser: fromUser || undefined,
          fromDomain: fromDomain || undefined,
          contactUser: contactUser || undefined,
          matchIp: matchIp || undefined,
          qualifyFrequency: parseOptionalInt(qualifyFrequency),
          registrationExpiration:
            trunkType === 'auth' ? parseOptionalInt(registrationExpiration) : undefined,
          maxChannels: parseOptionalInt(maxChannels) ?? 0,
          advanced: Object.keys(advancedState).length > 0 ? advancedState : undefined,
        }).unwrap();
      } else if (selected) {
        await updateTrunk({
          trunkId: selected.id,
          data: {
            host: host || undefined,
            port: port ? parseInt(port, 10) : undefined,
            username: username || undefined,
            password: password || undefined,
            context: context || undefined,
            transport: transport || undefined,
            codecs: codecs.join(','),
            fromUser: fromUser || undefined,
            fromDomain: fromDomain || undefined,
            contactUser: contactUser || undefined,
            matchIp: matchIp || undefined,
            qualifyFrequency: parseOptionalInt(qualifyFrequency),
            registrationExpiration:
              trunkType === 'auth' ? parseOptionalInt(registrationExpiration) : undefined,
            maxChannels: parseOptionalInt(maxChannels) ?? 0,
            advanced: Object.keys(advancedState).length > 0 ? advancedState : undefined,
          },
        }).unwrap();
      }
      // Schedule delayed refetch to pick up registration status change
      scheduleDelayedRefetch();
      handleClose();
    } catch (e: any) {
      toast.error(t("modal.errors.save"));
    }
  };

  const toggleCodec = (codec: string) => {
    setCodecs((prev) =>
      prev.includes(codec) ? prev.filter((c) => c !== codec) : [...prev, codec],
    );
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>


        <FormDialogContent size="large" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle >
              {mode === 'edit'
                ? t('trunks.editTrunk')
                : mode === 'copy'
                  ? t('trunks.copyTrunk', 'Копировать транк')
                  : t('trunks.addTrunk')}
            </DialogTitle>

          </DialogHeader>

          {/* Tabs */}
          <ModalTabs items={[
                { id: 'basic', label: t('trunks.tabBasic', 'Основные') },
                { id: 'auth', label: t('trunks.tabAuth', 'Подключение') },
                { id: 'network', label: t('trunks.tabNetwork', 'Сеть') },
                { id: 'advanced', label: t('trunks.tabAdvanced', 'Расширенные') },
              ]} value={activeTab} onChange={(value) => setActiveTab(value as typeof activeTab)} label={t("trunks.tabGeneral", t("common.settings"))} />

          <ModalBody>
            {activeTab === 'basic' && (
              <ModalSection title={t("modal.sections.identity")}>

                {/* Trunk Name */}
                <VStack align="stretch" gap="4">
                  <Label htmlFor="trunk-name" className={cls.fieldLabel}>
                    {t('trunks.name')}
                  </Label>
                  <Input
                    id="trunk-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('trunks.namePlaceholder', 'my-provider')}
                    disabled={mode === 'edit'}
                    className={cls.mono}
                  />
                </VStack>

                {/* Trunk Type */}
                <VStack align="stretch" gap="4">
                  <HStack gap="4" align="center">
                    <Label className={cls.fieldLabel}>
                      {t('trunks.type')}
                    </Label>
                    <InfoTooltip text={t('trunks.typeDesc', 'По логину: Asterisk будет отправлять запросы на сервер провайдера. По IP: Asterisk будет ждать звонков от провайдера, авторизуя их по источнику.')} />
                  </HStack>
                  <HStack gap="8">
                    <Button
                      type="button"
                      disabled={!isCreateMode}
                      onClick={() => setTrunkType('auth')}
                      className={[cls.typeChoice, trunkType === 'auth' && cls.selected].filter(Boolean).join(" ")}
                    >
                      <Key className={cls.icon} />
                      {t('trunks.typeAuth')}
                    </Button>
                    <Button
                      type="button"
                      disabled={!isCreateMode}
                      onClick={() => setTrunkType('ip')}
                      className={[cls.typeChoice, trunkType === 'ip' && cls.selected].filter(Boolean).join(" ")}
                    >
                      <Globe className={cls.icon} />
                      {t('trunks.typeIp')}
                    </Button>
                  </HStack>
                  <Text className={cls.hintText}>
                    {trunkType === 'auth'
                      ? t('trunks.typeAuthHint')
                      : t('trunks.typeIpHint')}
                  </Text>
                </VStack>

                {/* Host */}
                <VStack align="stretch" gap="4">
                  <HStack gap="4" align="center">
                    <Label htmlFor="trunk-host" className={cls.fieldLabel}>
                      {t('trunks.host')}
                    </Label>
                    <InfoTooltip text={t('trunks.hostDesc', 'Адрес (IP или домен) сервера провайдера, на который будут отправляться ваши звонки и SIP REGISTER запросы.')} />
                  </HStack>
                  <HStack gap="8">
                    <Input
                      id="trunk-host"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder={t('trunks.hostPlaceholder', 'sip.provider.com')}
                      className={cls.mono}
                    />
                    <Input
                      id="trunk-port"
                      value={port}
                      onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
                      placeholder={t('trunks.portPlaceholder', '5060')}
                      className={cls.portControl}
                    />
                  </HStack>
                </VStack>

                {/* Context */}
                <VStack align="stretch" gap="4">
                  <Label htmlFor="trunk-context" className={cls.fieldLabel}>
                    {t('trunks.context', 'Контекст')} *
                  </Label>
                  <Select
                    id="trunk-context"
                    value={context}
                    onChange={(e) => chooseContext(e.target.value)}
                    required
                    className={cls.control}
                  >
                    <option value="" disabled>{t('trunks.selectContext')}</option>
                    {contexts.map((c) => (
                      <option key={c.uid} value={c.name}>
                        {c.name} {c.comment ? `(${c.comment})` : ''}
                      </option>
                    ))}
                  </Select>
                </VStack>

                <VStack align="stretch" gap="4">
                  <HStack gap="4" align="center">
                    <Label htmlFor="trunk-max-channels" className={cls.fieldLabel}>
                      {t('trunks.maxChannels', 'Лимит каналов')}
                    </Label>
                    <InfoTooltip
                      text={t(
                        'trunks.maxChannelsDesc',
                        'Сколько одновременных вызовов Asterisk и автообзвон держат на этом транке. Пусто или 0 — без ограничения.',
                      )}
                    />
                  </HStack>
                  <Input
                    id="trunk-max-channels"
                    type="number"
                    min={0}
                    value={maxChannels}
                    onChange={(e) => setMaxChannels(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('trunks.maxChannelsPlaceholder', 'без ограничения')}
                    className={cls.narrowControl}
                  />
                </VStack>

</ModalSection>
            )}

            {activeTab === 'auth' && (
              <ModalSection title={t("modal.sections.connection")}>

                {trunkType === 'auth' ? (
                  <>
                    {/* Auth trunk fields */}
                    <VStack align="stretch" max className={cls.hintCard}>
                      <h4 className={cls.hintTitle}>
                        {t('trunks.authTitle', 'Outbound Registration')}
                      </h4>
                      <Text className={cls.hintText}>
                        {t('trunks.authDesc')}
                      </Text>
                    </VStack>

                    <VStack align="stretch" gap="4">
                      <Label htmlFor="trunk-username" className={cls.fieldLabel}>
                        {t('trunks.username')}
                      </Label>
                      <Input
                        id="trunk-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('trunks.usernamePlaceholder', 'sip_login')}
                        className={cls.mono}
                      />
                    </VStack>

                    <VStack align="stretch" gap="4">
                      <Label htmlFor="trunk-password" className={cls.fieldLabel}>
                        {t('trunks.password', 'Пароль')}
                      </Label>
                      <PasswordInput
                        id="trunk-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'edit' ? t('users.passwordUnchanged') : '••••••••'}
                        className={cls.mono}
                      />
                    </VStack>

                    <VStack align="stretch" gap="4">
                      <Label htmlFor="trunk-contact-user" className={cls.fieldLabel}>
                        {t('trunks.contactUser', 'Contact User')} <Text className={cls.muted}>{t('trunks.contactUserLabelExtra', '(DID / B-номер)')}</Text>
                      </Label>
                      <Input
                        id="trunk-contact-user"
                        value={contactUser}
                        onChange={(e) => setContactUser(e.target.value)}
                        placeholder={t('trunks.contactUserPlaceholder', 'Например: 5551234')}
                        className={cls.mono}
                      />
                      <Text className={cls.hintText}>
                        {t('trunks.contactUserHintLong', 'Номер, на который будут приходить звонки от провайдера. Вам потребуется создать правило во входящей маршрутизации для обработки этого номера.')}
                      </Text>
                    </VStack>

                    <HStack gap="16" align="start">
                      <VStack align="stretch" gap="4" className={cls.control}>
                        <HStack gap="4" align="center">
                          <Label htmlFor="trunk-from-user" className={cls.fieldLabel}>
                            {t('trunks.fromUser', 'From User')}
                          </Label>
                          <InfoTooltip text={t('trunks.fromUserDesc', 'Устанавливает имя пользователя (CallerID) в заголовке From. Если не заполнено, будет использован Логин.')} />
                        </HStack>
                        <Input
                          id="trunk-from-user"
                          value={fromUser}
                          onChange={(e) => setFromUser(e.target.value)}
                          placeholder={t('trunks.fromUserHint', 'Обычно совпадает с логином')}
                          className={cls.mono}
                        />
                      </VStack>

                      <VStack align="stretch" gap="4" className={cls.control}>
                        <HStack gap="4" align="center">
                          <Label htmlFor="trunk-from-domain" className={cls.fieldLabel}>
                            {t('trunks.fromDomain', 'From Domain')}
                          </Label>
                          <InfoTooltip text={t('trunks.fromDomainDesc', 'Устанавливает домен в заголовках SIP. Заполняйте только если провайдер требует регистрации в определённом домене, который отличается от Host (как у Beeline/Rostelecom).')} />
                        </HStack>
                        <Input
                          id="trunk-from-domain"
                          value={fromDomain}
                          onChange={(e) => setFromDomain(e.target.value)}
                          placeholder={t('trunks.fromDomainPlaceholder', 'sip.provider.com')}
                          className={cls.mono}
                        />
                      </VStack>
                    </HStack>

                    <VStack align="stretch" gap="4">
                      <HStack gap="4" align="center">
                        <Label htmlFor="trunk-match-ip-auth" className={cls.fieldLabel}>
                          {t('trunks.matchIp', 'IP / Подсеть провайдера')}
                        </Label>
                        <InfoTooltip text={t('trunks.matchIpAuthDesc', '**Пусто** - берётся Хост\n**IP или подсети** - входящие с этих адресов идут на этот транк\nБез совпадения вызов не попадёт на транк')} />
                      </HStack>
                      <Input
                        id="trunk-match-ip-auth"
                        value={matchIp}
                        onChange={(e) => setMatchIp(e.target.value)}
                        placeholder={host || t('trunks.matchIpPlaceholder', '203.0.113.0/24')}
                        className={cls.mono}
                      />
                    </VStack>
                  </>
                ) : (
                  <>
                    {/* IP trunk fields */}
                    <VStack align="stretch" max className={cls.warningCard}>
                      <h4 className={cls.hintTitle}>
                        {t('trunks.ipTitle', 'Identify by IP')}
                      </h4>
                      <Text className={cls.hintText}>
                        {t('trunks.ipDesc')}
                      </Text>
                    </VStack>

                    <VStack align="stretch" gap="4">
                      <Label htmlFor="trunk-match-ip" className={cls.fieldLabel}>
                        {t('trunks.matchIp', 'IP / Подсеть провайдера')}
                      </Label>
                      <Input
                        id="trunk-match-ip"
                        value={matchIp}
                        onChange={(e) => setMatchIp(e.target.value)}
                        placeholder={t('trunks.matchIpPlaceholder', '203.0.113.0/24')}
                        className={cls.mono}
                      />
                      <Text className={cls.hintText}>
                        {t('trunks.matchIpHint')}
                      </Text>
                    </VStack>
                  </>
                )}

</ModalSection>
            )}

            {activeTab === 'network' && (
              <ModalSection title={t("modal.sections.connection")}>

                {/* Transport */}
                <VStack align="stretch" gap="4">
                  <Label htmlFor="trunk-transport" className={cls.fieldLabel}>
                    {t('trunks.transport', 'Транспорт')}
                  </Label>
                  <Select
                    id="trunk-transport"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className={cls.control}
                  >
                    {TRANSPORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value ? opt.label : t("modal.defaultOption")}
                      </option>
                    ))}
                  </Select>
                </VStack>

                {/* Codecs */}
                <VStack align="stretch" gap="4">
                  <Label className={cls.fieldLabel}>
                    {t('trunks.codecs', 'Кодеки')}
                  </Label>
                  <Flex wrap="wrap" gap="8">
                    {CODEC_OPTIONS.map((codec) => (
                      <Button
                        key={codec}
                        type="button"
                        onClick={() => toggleCodec(codec)}
                        className={[cls.codec, codecs.includes(codec) && cls.selected].filter(Boolean).join(" ")}
                      >
                        {codec}
                      </Button>
                    ))}
                  </Flex>
                </VStack>

                <HStack gap="16" align="start">
                  <VStack align="stretch" gap="4" className={cls.control}>
                    <HStack gap="4" align="center">
                      <Label htmlFor="trunk-qualify" className={cls.fieldLabel}>
                        {t('trunks.qualifyFrequency')}
                      </Label>
                      <InfoTooltip text={t('trunks.qualifyFrequencyDesc')} />
                    </HStack>
                    <Input
                      id="trunk-qualify"
                      type="number"
                      min={0}
                      max={3600}
                      value={qualifyFrequency}
                      onChange={(e) => setQualifyFrequency(e.target.value)}
                      placeholder={t('trunks.qualifyFrequencyPlaceholder')}
                      className={cls.mono}
                    />
                  </VStack>

                  {trunkType === 'auth' && (
                    <VStack align="stretch" gap="4" className={cls.control}>
                      <HStack gap="4" align="center">
                        <Label htmlFor="trunk-reg-exp" className={cls.fieldLabel}>
                          {t('trunks.registrationExpiration')}
                        </Label>
                        <InfoTooltip text={t('trunks.registrationExpirationDesc')} />
                      </HStack>
                      <Input
                        id="trunk-reg-exp"
                        type="number"
                        min={60}
                        max={86400}
                        value={registrationExpiration}
                        onChange={(e) => setRegistrationExpiration(e.target.value)}
                        placeholder={t('trunks.registrationExpirationPlaceholder')}
                        className={cls.mono}
                      />
                    </VStack>
                  )}
                </HStack>

</ModalSection>
            )}

            {activeTab === 'advanced' && (
              <AdvancedSettingsBuilder
                value={advancedState}
                onChange={setAdvancedState}
                excludeFields={['from_user', 'from_domain', 'contact_user']}
              />
            )}
          </ModalBody>

          {/* Actions */}
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isLoading ||
                (!name && isCreateMode) ||
                !host ||
                !context ||
                (trunkType === 'auth' && !username && isCreateMode)
              }
            >
              {isLoading ? t('common.loading') : t('common.save')}
            </Button>
          </DialogFooter>
        </FormDialogContent>

    </Dialog>
  );
};
