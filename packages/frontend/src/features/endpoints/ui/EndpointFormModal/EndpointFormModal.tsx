import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { X, RefreshCw } from 'lucide-react';
import { Button, Input, InfoTooltip } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  selectEndpointIsModalOpen,
  selectSelectedEndpoint,
  selectEndpointModalMode,
} from '../../model/selectors/endpointsPageSelectors';
import { endpointsPageActions } from '../../model/slice/endpointsPageSlice';
import {
  useCreateEndpointMutation,
  useUpdateEndpointMutation,
} from '@/shared/api/endpoints/endpointApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useGetProvisionTemplatesQuery } from '@/shared/api/endpoints/provisionTemplateApi';
import { PickupGroupSelect } from '../PickupGroupSelect/PickupGroupSelect';
import { ADVANCED_PJSIP_FIELDS } from '../../config/pjsipAdvancedFields';
import { AdvancedSettingsBuilder } from '../AdvancedSettingsBuilder';

const NAT_PROFILES = [
  { value: 'lan', labelKey: 'endpoints.natLan' },
  { value: 'nat', labelKey: 'endpoints.natNat' },
  { value: 'webrtc', labelKey: 'endpoints.natWebrtc' },
];

const CODEC_OPTIONS = [
  'ulaw', 'alaw', 'g722', 'g729', 'gsm', 'opus', 'h264', 'vp8',
];

const TRANSPORT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'transport-udp', label: 'UDP' },
  { value: 'transport-tcp', label: 'TCP' },
  { value: 'transport-tls', label: 'TLS' },
  { value: 'transport-ws', label: 'WebSocket (WS)' },
  { value: 'transport-wss', label: 'WebSocket Secure (WSS)' },
];

function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let result = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export const EndpointFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectEndpointIsModalOpen);
  const selected = useAppSelector(selectSelectedEndpoint);
  const mode = useAppSelector(selectEndpointModalMode);

  const [createEndpoint, { isLoading: isCreating }] = useCreateEndpointMutation();
  const [updateEndpoint, { isLoading: isUpdating }] = useUpdateEndpointMutation();
  const { data: contexts = [] } = useGetContextsQuery();
  const { data: templates = [] } = useGetProvisionTemplatesQuery();

  const [activeTab, setActiveTab] = useState<'basic' | 'network' | 'security' | 'calls' | 'provision' | 'advanced'>('basic');

  // Form state
  const [extension, setExtension] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [context, setContext] = useState('');
  const [transport, setTransport] = useState('transport-udp');
  const [codecs, setCodecs] = useState<string[]>(['ulaw', 'alaw', 'g722']);
  const [natProfile, setNatProfile] = useState('nat');
  
  // Call Groups
  const [namedCallGroup, setNamedCallGroup] = useState<string[]>([]);
  const [namedPickupGroup, setNamedPickupGroup] = useState<string[]>([]);

  // Provisioning
  const [provisionEnabled, setProvisionEnabled] = useState(false);
  const [macAddress, setMacAddress] = useState('');
  const [provisionTemplateId, setProvisionTemplateId] = useState<number | ''>('');
  const [pvVars, setPvVars] = useState('');
  
  // Security
  const [permit, setPermit] = useState('');
  const [deny, setDeny] = useState('');

  // Advanced Dynamic Settings
  const [advancedState, setAdvancedState] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) setActiveTab('basic');
    
    if (mode === 'edit' && selected) {
      setExtension(selected.extension || '');
      const match = (selected.callerid || '').match(/^"(.+?)"/);
      setDisplayName(match ? match[1] : '');
      setDepartment(selected.department || '');
      setPassword('');
      setContext(selected.context || '');
      setTransport(selected.transport || '');
      setCodecs((selected.allow || 'ulaw,alaw').split(',').map((s: string) => s.trim()));
      setNatProfile('nat');
      
      setNamedCallGroup((selected.named_call_group || '').split(',').filter(Boolean));
      setNamedPickupGroup((selected.named_pickup_group || '').split(',').filter(Boolean));
      
      setProvisionEnabled(!!selected.provision_enabled);
      setMacAddress(selected.mac_address || '');
      setProvisionTemplateId(selected.provision_template_id || '');
      setPvVars(selected.pv_vars || '');
      setPermit(selected.permit || '');
      setDeny(selected.deny || '');
      
      const initAdv: Record<string, string> = {};
      ADVANCED_PJSIP_FIELDS.forEach((key) => {
        if (selected[key] !== undefined && selected[key] !== null && selected[key] !== '') {
          initAdv[key] = String(selected[key]);
        }
      });
      setAdvancedState(initAdv);
    } else {
      setExtension('');
      setDisplayName('');
      setDepartment('');
      setPassword(generatePassword());
      setContext('');
      setTransport('transport-udp');
      setCodecs(['ulaw', 'alaw', 'g722']);
      setNatProfile('nat');
      setNamedCallGroup([]);
      setNamedPickupGroup([]);
      setProvisionEnabled(false);
      setMacAddress('');
      setProvisionTemplateId('');
      setPvVars('');
      setPermit('');
      setDeny('');
      setAdvancedState({});
    }
  }, [mode, selected, isOpen]);

  const handleClose = useCallback(() => {
    dispatch(endpointsPageActions.closeModal());
  }, [dispatch]);

  const handleSubmit = async () => {
    try {
      if (mode === 'create') {
        await createEndpoint({
          extension,
          password,
          displayName: displayName || undefined,
          department: department || undefined,
          context: context || undefined,
          transport: transport || undefined,
          codecs: codecs.join(','),
          natProfile,
          namedCallGroup: namedCallGroup.join(','),
          namedPickupGroup: namedPickupGroup.join(','),
          provisionEnabled,
          macAddress: macAddress || undefined,
          provisionTemplateId: provisionTemplateId || undefined,
          pvVars: pvVars || undefined,
          advanced: {
            permit: permit || null,
            deny: deny || null,
            ...advancedState,
          },
        }).unwrap();
      } else if (selected) {
        await updateEndpoint({
          sipId: selected.id,
          data: {
            endpoint: {
              callerid: displayName ? `"${displayName}" <${extension}>` : `"${extension}" <${extension}>`,
              department: department || '',
              context: context || undefined,
              transport: transport || undefined,
              allow: codecs.join(','),
              named_call_group: namedCallGroup.join(','),
              named_pickup_group: namedPickupGroup.join(','),
              provision_enabled: provisionEnabled ? 1 : 0,
              mac_address: macAddress || '',
              provision_template_id: provisionTemplateId || null,
              pv_vars: pvVars || '',
              permit: permit || null,
              deny: deny || null,
              ...advancedState,
            },
            ...(password ? { auth: { password } } : {}),
          },
        }).unwrap();
      }
      handleClose();
    } catch (e: any) {
      alert(e.data?.message || 'Error saving endpoint');
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
              {mode === 'create' ? t('endpoints.addEndpoint') : t('endpoints.editEndpoint')}
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
              { id: 'basic', label: t('endpoints.tabBasic', 'Основные') },
              { id: 'network', label: t('endpoints.tabNetwork', 'Сеть') },
              { id: 'security', label: t('endpoints.tabSecurity', 'Безопасность') },
              { id: 'calls', label: t('endpoints.tabCalls', 'Вызовы') },
              { id: 'provision', label: t('endpoints.tabProvision', 'Автопровижинг') },
              { id: 'advanced', label: t('endpoints.tabAdvanced', 'Расширенные') },
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
                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label htmlFor="ep-extension" className="text-sm font-medium text-muted-foreground">{t('endpoints.extension')}</label>
                    <InfoTooltip text={t('endpoints.extensionDesc', 'Уникальный номер (SIP-логин) устройства. Используется для регистрации и внутренних звонков.')} />
                  </HStack>
                  <Input
                    id="ep-extension"
                    value={extension}
                    onChange={(e) => setExtension(e.target.value)}
                    placeholder="100"
                    disabled={mode === 'edit'}
                    className="font-mono"
                  />
                </VStack>

                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label htmlFor="ep-name" className="text-sm font-medium text-muted-foreground">{t('endpoints.displayName')}</label>
                    <InfoTooltip text={t('endpoints.displayNameDesc', 'Имя, которое будет отображаться на экранах телефонов при внутренних звонках от этого абонента (CallerID Name).')} />
                  </HStack>
                  <Input
                    id="ep-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Иван Петров"
                  />
                </VStack>

                <VStack gap="4">
                  <label htmlFor="ep-dept" className="text-sm font-medium text-muted-foreground">{t('endpoints.department', 'Отдел')}</label>
                  <Input
                    id="ep-dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Бухгалтерия"
                  />
                </VStack>

                <VStack gap="4">
                  <HStack justify="between" align="center" max>
                    <label htmlFor="ep-password" className="text-sm font-medium text-muted-foreground">{t('endpoints.password')}</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setPassword(generatePassword())}
                    >
                      <RefreshCw className="w-3 h-3" />
                      {t('endpoints.autoGenPassword')}
                    </Button>
                  </HStack>
                  <Input
                    id="ep-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'edit' ? t('users.passwordUnchanged') : ''}
                    className="font-mono"
                  />
                  <VStack gap="4">
                    <HStack gap="4" align="center">
                      <label htmlFor="ep-context" className="text-sm font-medium text-muted-foreground">{t('endpoints.context')}</label>
                      <InfoTooltip text={t('endpoints.contextDesc', 'Раздел диалплана (правил маршрутизации), в который попадают все вызовы, инициируемые этим телефоном.')} />
                    </HStack>
                    <select
                      id="ep-context"
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent"
                    >
                      <option value="">— Default —</option>
                      {contexts.map((c) => (
                        <option key={c.uid} value={c.name}>
                          {c.name} {c.comment ? `(${c.comment})` : ''}
                        </option>
                      ))}
                    </select>
                  </VStack>
                </VStack>
              </VStack>
            )}

            {activeTab === 'network' && (
              <VStack gap="16">

                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label htmlFor="ep-transport" className="text-sm font-medium text-muted-foreground">{t('endpoints.transport')}</label>
                    <InfoTooltip text={t('endpoints.transportDesc', 'Обычно UDP/TCP для аппаратных телефонов. Для звонков через браузер обязательно выберите WSS.')} />
                  </HStack>
                  <select
                    id="ep-transport"
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

                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label className="text-sm font-medium text-muted-foreground">{t('endpoints.natProfile')}</label>
                    <InfoTooltip text={t('endpoints.natDesc', 'LAN: телефон в одной локальной сети с АТС. NAT: телефон находится за роутером где-то в интернете. WebRTC: профиль для софтфона в браузере (включает шифрование и ICE).')} />
                  </HStack>
                  <HStack gap="8">
                    {NAT_PROFILES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setNatProfile(p.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          natProfile === p.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        {t(p.labelKey)}
                      </button>
                    ))}
                  </HStack>
                </VStack>

                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <label className="text-sm font-medium text-muted-foreground">{t('endpoints.codecs')}</label>
                    <InfoTooltip text={t('endpoints.codecsDesc', 'Разрешённые аудио/видео форматы. Оставьте ulaw/alaw для обычных телефонов. Для софтфонов рекомендуются opus и vp8/h264.')} />
                  </HStack>
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

            {activeTab === 'security' && (
              <VStack gap="16">
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-2">
                  <h4 className="text-sm font-semibold text-primary mb-1">{t('endpoints.ipFilterTitle')}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('endpoints.ipFilterDesc')}
                  </p>
                </div>
                <VStack gap="4">
                  <label htmlFor="ep-deny" className="text-sm font-medium text-muted-foreground">{t('endpoints.denyNetworks')}</label>
                  <Input
                    id="ep-deny"
                    value={deny}
                    onChange={(e) => setDeny(e.target.value)}
                    placeholder="192.168.1.0/24"
                    className="font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">{t('endpoints.denyNetworksHint')}</p>
                </VStack>

                <VStack gap="4">
                  <label htmlFor="ep-permit" className="text-sm font-medium text-muted-foreground">{t('endpoints.permitNetworks')}</label>
                  <Input
                    id="ep-permit"
                    value={permit}
                    onChange={(e) => setPermit(e.target.value)}
                    placeholder="192.168.1.0/24, 10.0.0.5/32"
                    className="font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">{t('endpoints.permitNetworksHint')}</p>
                </VStack>
              </VStack>
            )}

            {activeTab === 'calls' && (
              <VStack gap="16">
                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <span className="text-sm font-medium text-muted-foreground">{t('endpoints.namedCallGroup')}</span>
                    <InfoTooltip text={t('endpoints.namedCallGroupDesc', 'В какие группы звонит этот телефон.')} />
                  </HStack>
                  <PickupGroupSelect 
                    label=""
                    selectedSlugs={namedCallGroup}
                    onChange={setNamedCallGroup}
                  />
                </VStack>
                <VStack gap="4">
                  <HStack gap="4" align="center">
                    <span className="text-sm font-medium text-muted-foreground">{t('endpoints.namedPickupGroup')}</span>
                    <InfoTooltip text={t('endpoints.namedPickupGroupDesc', 'Звонки каких групп этот телефон может перехватывать (обычно по комбинации *8).')} />
                  </HStack>
                  <PickupGroupSelect 
                    label=""
                    selectedSlugs={namedPickupGroup}
                    onChange={setNamedPickupGroup}
                  />
                </VStack>
              </VStack>
            )}

            {activeTab === 'provision' && (
              <VStack gap="16">
                <label className="flex items-center gap-3 p-3 border border-border rounded-lg bg-background/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={provisionEnabled}
                    onChange={e => setProvisionEnabled(e.target.checked)}
                    className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t('endpoints.provEnable')}</span>
                    <span className="text-xs text-muted-foreground">{t('endpoints.provEnableHint')}</span>
                  </div>
                </label>

                {provisionEnabled && (
                  <>
                    <VStack gap="4">
                      <label htmlFor="ep-mac" className="text-sm font-medium text-muted-foreground">{t('endpoints.provMac')}</label>
                      <Input
                        id="ep-mac"
                        value={macAddress}
                        onChange={(e) => setMacAddress(e.target.value.toLowerCase().replace(/[^a-f0-9]/g, ''))}
                        placeholder="a0b1c2d3e4f5"
                        className="font-mono bg-background/50 uppercase"
                      />
                    </VStack>

                    <VStack gap="4">
                      <label htmlFor="ep-tpl" className="text-sm font-medium text-muted-foreground">{t('endpoints.provTemplate')}</label>
                      <select
                        id="ep-tpl"
                        value={provisionTemplateId}
                        onChange={(e) => setProvisionTemplateId(parseInt(e.target.value, 10))}
                        className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent"
                      >
                        <option value="">{t('endpoints.provTemplateSelect')}</option>
                        {templates.map((tpl) => (
                          <option key={tpl.uid} value={tpl.uid}>
                            {tpl.name} {tpl.vendor ? `(${tpl.vendor})` : ''}
                          </option>
                        ))}
                      </select>
                      {templates.length === 0 && (
                        <span className="text-xs text-amber-500">
                          {t('endpoints.provTemplateEmpty')}
                        </span>
                      )}
                    </VStack>

                    <VStack gap="4">
                      <label htmlFor="ep-vars" className="text-sm font-medium text-muted-foreground">
                        {t('endpoints.provVars')}
                      </label>
                      <textarea
                        id="ep-vars"
                        value={pvVars}
                        onChange={(e) => setPvVars(e.target.value)}
                        placeholder="$custom_port=5062&#10;$button1_type=speeddial"
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary focus:border-transparent"
                      />
                    </VStack>
                  </>
                )}
              </VStack>
            )}

            {activeTab === 'advanced' && (
              <AdvancedSettingsBuilder
                value={advancedState}
                onChange={setAdvancedState}
              />
            )}
          </div>

          {/* Actions */}
          <HStack gap="8" justify="end" className="mt-8 pt-4 border-t border-border shrink-0">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || (!extension && mode === 'create') || !context || (provisionEnabled && !macAddress)}>
              {isLoading ? t('common.loading') : t('common.save')}
            </Button>
          </HStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
