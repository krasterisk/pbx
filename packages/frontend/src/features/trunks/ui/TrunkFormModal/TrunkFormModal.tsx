import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button, Input, InfoTooltip } from '@/shared/ui';
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
import { ADVANCED_PJSIP_FIELDS } from '../../../endpoints/config/pjsipAdvancedFields';
import { AdvancedSettingsBuilder } from '../../../endpoints/ui/AdvancedSettingsBuilder';

const CODEC_OPTIONS = [
  'ulaw', 'alaw', 'g722', 'g729', 'gsm', 'opus',
];

const TRANSPORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'transport-udp', label: 'UDP' },
  { value: 'transport-tcp', label: 'TCP' },
  { value: 'transport-tls', label: 'TLS' },
];

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

      const initAdv: Record<string, string> = {};
      ADVANCED_PJSIP_FIELDS.forEach((key) => {
        if (key === 'from_domain' || key === 'from_user' || key === 'contact_user') return;
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
      setAdvancedState({});
    }
  }, [mode, selected, isOpen]);

  const handleClose = useCallback(() => {
    dispatch(trunksPageActions.closeModal());
  }, [dispatch]);

  const isCreateMode = mode === 'create' || mode === 'copy';

  const handleSubmit = async () => {
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
            advanced: Object.keys(advancedState).length > 0 ? advancedState : undefined,
          },
        }).unwrap();
      }
      // Schedule delayed refetch to pick up registration status change
      scheduleDelayedRefetch();
      handleClose();
    } catch (e: any) {
      alert(e.data?.message || 'Error saving trunk');
    }
  };

  const toggleCodec = (codec: string) => {
    setCodecs((prev) =>
      prev.includes(codec) ? prev.filter((c) => c !== codec) : [...prev, codec],
    );
  };

  const isLoading = isCreating || isUpdating;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed top-[5%] left-1/2 -translate-x-1/2 w-full max-w-xl bg-card text-card-foreground border border-border rounded-2xl p-6 z-50 shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
          <HStack justify="between" align="center" className="mb-4 shrink-0">
            <Dialog.Title className="text-xl font-bold">
              {mode === 'edit'
                ? t('trunks.editTrunk')
                : mode === 'copy'
                  ? t('trunks.copyTrunk', 'Копировать транк')
                  : t('trunks.addTrunk')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </HStack>

          {/* Tabs */}
          <HStack gap="4" className="border-b border-border mb-6 shrink-0 overflow-x-auto flex-nowrap pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {[
              { id: 'basic', label: t('trunks.tabBasic', 'Основные') },
              { id: 'auth', label: t('trunks.tabAuth', 'Подключение') },
              { id: 'network', label: t('trunks.tabNetwork', 'Сеть') },
              { id: 'advanced', label: t('trunks.tabAdvanced', 'Расширенные') },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </HStack>

          <div className="flex-1 overflow-y-auto pr-1">
            {activeTab === 'basic' && (
              <VStack gap="16">
                {/* Trunk Name */}
                <VStack gap="4">
                  <label htmlFor="trunk-name" className="text-sm font-medium text-muted-foreground">
                    {t('trunks.name')}
                  </label>
                  <Input
                    id="trunk-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('trunks.namePlaceholder', 'my-provider')}
                    disabled={mode === 'edit'}
                    className="font-mono"
                  />
                </VStack>

                {/* Trunk Type */}
                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label className="text-sm font-medium text-muted-foreground">
                      {t('trunks.type')}
                    </label>
                    <InfoTooltip text={t('trunks.typeDesc', 'По логину: Asterisk будет отправлять запросы на сервер провайдера. По IP: Asterisk будет ждать звонков от провайдера, авторизуя их по источнику.')} />
                  </HStack>
                  <HStack gap="8">
                    <button
                      type="button"
                      disabled={!isCreateMode}
                      onClick={() => setTrunkType('auth')}
                      className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                        trunkType === 'auth'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      } ${!isCreateMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      🔑 {t('trunks.typeAuth')}
                    </button>
                    <button
                      type="button"
                      disabled={!isCreateMode}
                      onClick={() => setTrunkType('ip')}
                      className={`px-4 py-2 rounded-lg text-sm border transition-all ${
                        trunkType === 'ip'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      } ${!isCreateMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      🌐 {t('trunks.typeIp')}
                    </button>
                  </HStack>
                  <p className="text-[11px] text-muted-foreground">
                    {trunkType === 'auth'
                      ? t('trunks.typeAuthHint')
                      : t('trunks.typeIpHint')}
                  </p>
                </VStack>

                {/* Host */}
                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label htmlFor="trunk-host" className="text-sm font-medium text-muted-foreground">
                      {t('trunks.host')}
                    </label>
                    <InfoTooltip text={t('trunks.hostDesc', 'Адрес (IP или домен) сервера провайдера, на который будут отправляться ваши звонки и SIP REGISTER запросы.')} />
                  </HStack>
                  <HStack gap="8">
                    <Input
                      id="trunk-host"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder={t('trunks.hostPlaceholder', 'sip.provider.com')}
                      className="font-mono flex-1"
                    />
                    <Input
                      id="trunk-port"
                      value={port}
                      onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
                      placeholder={t('trunks.portPlaceholder', '5060')}
                      className="font-mono w-24"
                    />
                  </HStack>
                </VStack>

                {/* Context */}
                <VStack gap="4">
                  <label htmlFor="trunk-context" className="text-sm font-medium text-muted-foreground">
                    {t('trunks.context', 'Контекст')}
                  </label>
                  <select
                    id="trunk-context"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent"
                  >
                    <option value="" disabled>{t('trunks.selectContext')}</option>
                    {contexts.map((c) => (
                      <option key={c.uid} value={c.name}>
                        {c.name} {c.comment ? `(${c.comment})` : ''}
                      </option>
                    ))}
                  </select>
                </VStack>
              </VStack>
            )}

            {activeTab === 'auth' && (
              <VStack gap="16">
                {trunkType === 'auth' ? (
                  <>
                    {/* Auth trunk fields */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-2">
                      <h4 className="text-sm font-semibold text-blue-400 mb-1">
                        {t('trunks.authTitle', 'Outbound Registration')}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t('trunks.authDesc')}
                      </p>
                    </div>

                    <VStack gap="4">
                      <label htmlFor="trunk-username" className="text-sm font-medium text-muted-foreground">
                        {t('trunks.username')}
                      </label>
                      <Input
                        id="trunk-username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={t('trunks.usernamePlaceholder', 'sip_login')}
                        className="font-mono"
                      />
                    </VStack>

                    <VStack gap="4">
                      <label htmlFor="trunk-password" className="text-sm font-medium text-muted-foreground">
                        {t('trunks.password', 'Пароль')}
                      </label>
                      <Input
                        id="trunk-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'edit' ? t('users.passwordUnchanged') : '••••••••'}
                        className="font-mono"
                      />
                    </VStack>

                    <VStack gap="4">
                      <label htmlFor="trunk-contact-user" className="text-sm font-medium text-muted-foreground">
                        {t('trunks.contactUser', 'Contact User')} <span className="text-muted-foreground/60 font-normal">{t('trunks.contactUserLabelExtra', '(DID / B-номер)')}</span>
                      </label>
                      <Input
                        id="trunk-contact-user"
                        value={contactUser}
                        onChange={(e) => setContactUser(e.target.value)}
                        placeholder={t('trunks.contactUserPlaceholder', 'Например: 5551234')}
                        className="font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {t('trunks.contactUserHintLong', 'Номер, на который будут приходить звонки от провайдера. Вам потребуется создать правило во входящей маршрутизации для обработки этого номера.')}
                      </p>
                    </VStack>

                    <HStack gap="16" align="start">
                      <VStack gap="4" className="flex-1 relative focus-within:z-10">
                        <HStack gap="4" align="center">
                          <label htmlFor="trunk-from-user" className="text-sm font-medium text-muted-foreground">
                            {t('trunks.fromUser', 'From User')}
                          </label>
                          <InfoTooltip text={t('trunks.fromUserDesc', 'Устанавливает имя пользователя (CallerID) в заголовке From. Если не заполнено, будет использован Логин.')} />
                        </HStack>
                        <Input
                          id="trunk-from-user"
                          value={fromUser}
                          onChange={(e) => setFromUser(e.target.value)}
                          placeholder={t('trunks.fromUserHint', 'Обычно совпадает с логином')}
                          className="font-mono bg-background"
                        />
                      </VStack>

                      <VStack gap="4" className="flex-1 relative focus-within:z-10">
                        <HStack gap="4" align="center">
                          <label htmlFor="trunk-from-domain" className="text-sm font-medium text-muted-foreground">
                            {t('trunks.fromDomain', 'From Domain')}
                          </label>
                          <InfoTooltip text={t('trunks.fromDomainDesc', 'Устанавливает домен в заголовках SIP. Заполняйте только если провайдер требует регистрации в определённом домене, который отличается от Host (как у Beeline/Rostelecom).')} />
                        </HStack>
                        <Input
                          id="trunk-from-domain"
                          value={fromDomain}
                          onChange={(e) => setFromDomain(e.target.value)}
                          placeholder={t('trunks.fromDomainPlaceholder', 'sip.provider.com')}
                          className="font-mono bg-background"
                        />
                      </VStack>
                    </HStack>
                  </>
                ) : (
                  <>
                    {/* IP trunk fields */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-2">
                      <h4 className="text-sm font-semibold text-amber-400 mb-1">
                        {t('trunks.ipTitle', 'Identify by IP')}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t('trunks.ipDesc')}
                      </p>
                    </div>

                    <VStack gap="4">
                      <label htmlFor="trunk-match-ip" className="text-sm font-medium text-muted-foreground">
                        {t('trunks.matchIp', 'IP / Подсеть провайдера')}
                      </label>
                      <Input
                        id="trunk-match-ip"
                        value={matchIp}
                        onChange={(e) => setMatchIp(e.target.value)}
                        placeholder={t('trunks.matchIpPlaceholder', '203.0.113.0/24')}
                        className="font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        {t('trunks.matchIpHint')}
                      </p>
                    </VStack>
                  </>
                )}
              </VStack>
            )}

            {activeTab === 'network' && (
              <VStack gap="16">
                {/* Transport */}
                <VStack gap="4">
                  <label htmlFor="trunk-transport" className="text-sm font-medium text-muted-foreground">
                    {t('trunks.transport', 'Транспорт')}
                  </label>
                  <select
                    id="trunk-transport"
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent"
                  >
                    {TRANSPORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </VStack>

                {/* Codecs */}
                <VStack gap="4">
                  <label className="text-sm font-medium text-muted-foreground">
                    {t('trunks.codecs', 'Кодеки')}
                  </label>
                  <Flex wrap="wrap" gap="8">
                    {CODEC_OPTIONS.map((codec) => (
                      <button
                        key={codec}
                        type="button"
                        onClick={() => toggleCodec(codec)}
                        className={`px-2.5 py-1 rounded-md text-xs font-mono transition-all ${
                          codecs.includes(codec)
                            ? 'bg-primary/10 text-primary border border-primary/40 dark:border-primary/20'
                            : 'bg-background/50 text-muted-foreground border border-border hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        {codec}
                      </button>
                    ))}
                  </Flex>
                </VStack>
              </VStack>
            )}

            {activeTab === 'advanced' && (
              <AdvancedSettingsBuilder
                value={advancedState}
                onChange={setAdvancedState}
                excludeFields={['from_user', 'from_domain', 'contact_user']}
              />
            )}
          </div>

          {/* Actions */}
          <HStack gap="8" justify="end" className="mt-8 pt-4 border-t border-border shrink-0">
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
          </HStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
