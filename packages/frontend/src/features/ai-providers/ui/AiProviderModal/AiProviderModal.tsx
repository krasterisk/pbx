import { FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  InfoTooltip,
  Input,
  Label,
  PasswordInput,
  Select,
  Switch,
  Text,
} from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  useCreateAiProviderMutation,
  useCreateGlobalAiProviderMutation,
  useUpdateAiProviderMutation,
  useUpdateGlobalAiProviderMutation,
  type AiCapability,
  type AiProviderKind,
  type IAiProvider,
} from '@/shared/api/endpoints/aiAgentsApi';
import { usePreviewPromptTtsMutation } from '@/shared/api/endpoints/promptsApi';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';
import styles from './AiProviderModal.module.scss';
import {
  clearedSpeechDefaults,
  hostedSpeechEndpoint,
  isHostedSpeechEndpoint,
  isSpeechVendor,
  SpeechCatalogFields,
  speechDefaultsFromFields,
  speechFieldsFromDefaults,
  yandexRole,
  type SpeechFieldValues,
  type SpeechVendor,
} from './SpeechCatalogFields';

interface Props {
  provider: IAiProvider | null;
  onClose: () => void;
  scope?: 'tenant' | 'global';
  /** Settings pages pin one capability so a new row shows up in that module. */
  requiredCapability?: AiCapability;
}

const ALL_CAPS: AiCapability[] = ['llm', 'stt', 'tts', 'realtime'];

type SpeechPreset = '' | SpeechVendor | 'other';

function initialCapability(provider: IAiProvider | null, required?: AiCapability): AiCapability {
  if (required && ALL_CAPS.includes(required)) return required;
  const caps = provider?.capabilities ?? [];
  const endpoint = (provider?.endpoint ?? '').trim().replace(/\/+$/, '');
  if (
    (endpoint === 'https://stt.api.cloud.yandex.net' || endpoint === 'https://speech.googleapis.com')
    && caps.includes('stt')
  ) return 'stt';
  if (
    (endpoint === 'https://tts.api.cloud.yandex.net' || endpoint === 'https://texttospeech.googleapis.com')
    && caps.includes('tts')
  ) return 'tts';
  return ALL_CAPS.find((cap) => caps.includes(cap)) ?? 'llm';
}

function initialSpeechPreset(provider: IAiProvider | null, cap: AiCapability): SpeechPreset {
  if (cap !== 'tts' && cap !== 'stt') return '';
  if (provider?.vendor === 'yandex' || provider?.vendor === 'google') return provider.vendor;
  if (!provider) return '';
  return 'other';
}
const PREVIEW_PHRASE = 'Проверка синтеза';

type CatalogAuth = 'bearer' | 'none' | 'custom';

function initialAuth(provider: IAiProvider | null): CatalogAuth {
  if (provider?.auth_type === 'none' || provider?.auth_type === 'custom') return provider.auth_type;
  if (provider?.auth_type === 'api_key_header') return 'custom';
  if (provider?.has_key && (!provider.auth_type || provider.auth_type === 'none')) return 'bearer';
  return 'bearer';
}

function initialAuthHeaders(provider: IAiProvider | null): Array<{ key: string; value: string }> {
  if (provider?.auth_type === 'api_key_header') return [{ key: 'X-API-Key', value: '' }];
  const keys = provider?.authHeaderKeys ?? [];
  return keys.length ? keys.map((key) => ({ key, value: '' })) : [{ key: '', value: '' }];
}

const CAP_KEYS: Record<AiCapability, string> = {
  llm: 'aiProviders.field.capLlm',
  stt: 'aiProviders.field.capStt',
  tts: 'aiProviders.field.capTts',
  realtime: 'aiProviders.field.capRealtime',
  tools: 'aiProviders.field.capLlm',
  function_calling: 'aiProviders.field.capLlm',
};

export function AiProviderModal({ provider, onClose, scope = 'tenant', requiredCapability }: Props) {
  const { t } = useTranslation();
  const isEdit = !!provider;

  const [name, setName] = useState(provider?.name ?? '');
  const [vendor, setVendor] = useState(provider?.vendor ?? '');
  const [kind, setKind] = useState<AiProviderKind>(provider?.kind ?? 'online');
  const [endpoint, setEndpoint] = useState(
    provider?.endpoint?.trim()
      || hostedSpeechEndpoint(provider?.vendor ?? '', provider?.capabilities ?? []),
  );
  const [authType, setAuthType] = useState<CatalogAuth>(() => initialAuth(provider));
  const [apiKey, setApiKey] = useState('');
  const [authHeaders, setAuthHeaders] = useState(() => initialAuthHeaders(provider));
  const [cap, setCap] = useState<AiCapability>(() => initialCapability(provider, requiredCapability));
  const [enabled, setEnabled] = useState(provider?.enabled !== false);
  const [model, setModel] = useState(
    typeof provider?.defaults?.model === 'string' ? provider.defaults.model : '',
  );
  const [speechPreset, setSpeechPreset] = useState<SpeechPreset>(() => (
    initialSpeechPreset(provider, initialCapability(provider, requiredCapability))
  ));
  const [speech, setSpeech] = useState<SpeechFieldValues>(() => speechFieldsFromDefaults(
    provider?.defaults,
    initialSpeechPreset(provider, initialCapability(provider, requiredCapability)) === 'other' ? 'plain' : 'preset',
  ));
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const [createTenant, tenantCreateState] = useCreateAiProviderMutation();
  const [updateTenant, tenantUpdateState] = useUpdateAiProviderMutation();
  const [createGlobal, globalCreateState] = useCreateGlobalAiProviderMutation();
  const [updateGlobal, globalUpdateState] = useUpdateGlobalAiProviderMutation();
  const createProvider = scope === 'global' ? createGlobal : createTenant;
  const updateProvider = scope === 'global' ? updateGlobal : updateTenant;
  const submitting = scope === 'global'
    ? globalCreateState.isLoading || globalUpdateState.isLoading
    : tenantCreateState.isLoading || tenantUpdateState.isLoading;
  const [previewTts, previewState] = usePreviewPromptTtsMutation();

  const speechMode = cap === 'tts' || cap === 'stt';
  const customSpeech = speechMode && speechPreset === 'other';
  const pinnedSpeechPage = requiredCapability === 'tts' || requiredCapability === 'stt';
  const canPreviewVoice = Boolean(
    provider?.uid
    && cap === 'tts'
    && (
      (isSpeechVendor(vendor) && provider.has_key)
      || (customSpeech && endpoint.trim())
    ),
  );

  useEffect(() => () => {
    audioRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const chooseCapability = (next: AiCapability) => {
    setCap(next);
    if (next === 'tts' || next === 'stt') {
      if (isSpeechVendor(vendor)) {
        const url = hostedSpeechEndpoint(vendor, [next]);
        if (url) setEndpoint(url);
      }
      return;
    }
    setEndpoint((current) => (isHostedSpeechEndpoint(current) ? '' : current));
  };

  const chooseSpeechVendor = (next: SpeechVendor) => {
    setSpeechPreset(next);
    setVendor(next);
    setKind('online');
    setAuthType('bearer');
    setSpeech(speechFieldsFromDefaults(undefined));
    setEndpoint(hostedSpeechEndpoint(next, [cap]));
  };

  const chooseOtherSpeech = () => {
    const leavingPreset = speechPreset !== 'other';
    setSpeechPreset('other');
    setKind('custom');
    setVendor((current) => (isSpeechVendor(current) || current === 'custom' ? '' : current));
    setEndpoint((current) => (isHostedSpeechEndpoint(current) ? '' : current));
    if (leavingPreset) setSpeech(speechFieldsFromDefaults(undefined, 'plain'));
  };

  const previewSettings = (): IIvrPhraseTtsSettings => (
    vendor === 'google'
      ? {
          voice: speech.voiceName,
          language_code: speech.languageCode,
          speaking_rate: speech.speakingRate,
        }
      : customSpeech
        ? {
            voice: speech.voice,
            language_code: speech.languageCode,
            speed: speech.speed,
          }
        : {
            voice: speech.voice,
            role: yandexRole(speech.voice, speech.role),
            speed: speech.speed,
            pitch_shift: speech.pitchShift,
          }
  );

  const handlePreview = async () => {
    if (!provider?.uid || !canPreviewVoice) return;
    setError(null);
    try {
      const blob = await previewTts({
        text: PREVIEW_PHRASE,
        engine_uid: provider.uid,
        settings: previewSettings(),
      }).unwrap();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => {
        if (audioUrlRef.current === url) {
          URL.revokeObjectURL(url);
          audioUrlRef.current = null;
        }
      };
      await audio.play();
    } catch {
      setError(t('aiProviders.error.previewFailed'));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError(t('aiProviders.error.nameRequired'));
    if (!endpoint.trim()) return setError(t('aiProviders.error.endpointRequired'));
    const chosen = pinnedSpeechPage && requiredCapability ? requiredCapability : cap;
    const extras = chosen === 'llm'
      ? (provider?.capabilities ?? []).filter((item) => item === 'tools' || item === 'function_calling')
      : [];
    const capabilities = [chosen, ...extras];

    const speechOn = chosen === 'tts' || chosen === 'stt';
    const speechPatch = speechDefaultsFromFields(vendor.trim() || 'custom', capabilities, speech);
    const payload = {
      name: name.trim(),
      vendor: vendor.trim() || 'custom',
      kind,
      endpoint: endpoint.trim(),
      auth_type: speechOn && !customSpeech ? 'bearer' : authType,
      capabilities,
      defaults: {
        ...(provider?.defaults ?? {}),
        ...(speechOn ? clearedSpeechDefaults() : {}),
        ...speechPatch,
        ...(chosen === 'llm' && model.trim() ? { model: model.trim() } : {}),
        ...(chosen === 'stt' && speechPatch.model ? { model: speechPatch.model } : {}),
      },
      enabled,
      ...((!speechOn || customSpeech) && authType === 'none' ? { apiKey: '' } : {}),
      ...((!speechOn || customSpeech) && authType === 'custom'
        ? { authHeaders: authHeaders.filter((row) => row.key.trim()) }
        : {}),
      ...(apiKey.trim() && (speechOn && !customSpeech || authType === 'bearer') ? { apiKey: apiKey.trim() } : {}),
    };

    try {
      if (isEdit && provider) {
        await updateProvider({ id: provider.uid, data: payload }).unwrap();
      } else {
        await createProvider(payload).unwrap();
      }
      onClose();
    } catch {
      setError(t('aiProviders.error.saveFailed'));
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className={`flex h-[min(44rem,90dvh)] max-h-[min(44rem,90dvh)] flex-col gap-0 overflow-hidden ${styles.dialogContent}`}
      >
        <DialogHeader className={styles.header}>
          <DialogTitle>
            {isEdit ? t('aiAgents.editProvider') : t('aiAgents.createProvider')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className={styles.form} autoComplete="off">
          <div className={styles.formBody}>
            <VStack gap="16" max>
              <VStack gap="8" max className={styles.field}>
                <Label htmlFor="ai-provider-name" className={styles.fieldLabel}>
                  {t('aiProviders.field.name')} *
                </Label>
                <Input
                  id="ai-provider-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </VStack>

              {!pinnedSpeechPage && (
                <VStack gap="8" max className={styles.field}>
                  <HStack gap="4" align="center">
                    <Label htmlFor="ai-provider-capability" className={styles.fieldLabel}>
                      {t('aiProviders.field.capabilities')}
                    </Label>
                    <InfoTooltip text={t('aiProviders.field.capabilitiesHint')} />
                  </HStack>
                  <Select
                    id="ai-provider-capability"
                    value={cap}
                    onChange={(event) => chooseCapability(event.target.value as AiCapability)}
                  >
                    {ALL_CAPS.map((item) => (
                      <option key={item} value={item}>{t(CAP_KEYS[item])}</option>
                    ))}
                  </Select>
                </VStack>
              )}

              <HStack gap="16" className={speechMode ? undefined : styles.row} max>
                <VStack gap="8" max className={styles.field}>
                  <HStack gap="4" align="center">
                    <Label htmlFor="ai-provider-vendor" className={styles.fieldLabel}>
                      {t('aiProviders.field.vendor')}
                    </Label>
                    <InfoTooltip text={t('aiProviders.field.vendorHint')} />
                  </HStack>
                  {speechMode ? (
                    <>
                      <Select
                        id="ai-provider-vendor"
                        value={speechPreset}
                        onChange={(event) => {
                          const next = event.target.value;
                          if (isSpeechVendor(next)) chooseSpeechVendor(next);
                          else if (next === 'other') chooseOtherSpeech();
                        }}
                      >
                        <option value="">{t('aiProviders.field.speechVendorPlaceholder')}</option>
                        <option value="yandex">{t('ttsEngines.typeYandex', 'Yandex SpeechKit')}</option>
                        <option value="google">{t('ttsEngines.typeGoogle', 'Google')}</option>
                        <option value="other">{t('aiProviders.field.speechVendorOther')}</option>
                      </Select>
                      {customSpeech && (
                        <Input
                          id="ai-provider-vendor-name"
                          aria-label={t('aiProviders.field.speechVendorName')}
                          value={vendor === 'custom' ? '' : vendor}
                          placeholder={t('aiProviders.field.speechVendorName')}
                          onChange={(event) => setVendor(event.target.value)}
                        />
                      )}
                    </>
                  ) : (
                    <Input
                      id="ai-provider-vendor"
                      value={vendor}
                      onChange={(event) => setVendor(event.target.value)}
                    />
                  )}
                </VStack>
                {!speechMode && (
                  <VStack gap="8" max className={styles.field}>
                    <HStack gap="4" align="center">
                      <Label htmlFor="ai-provider-kind" className={styles.fieldLabel}>
                        {t('aiProviders.field.kind')}
                      </Label>
                      <InfoTooltip text={t('aiProviders.field.kindHint')} />
                    </HStack>
                    <Select
                      id="ai-provider-kind"
                      value={kind}
                      onChange={(event) => setKind(event.target.value as AiProviderKind)}
                    >
                      <option value="online">{t('aiProviders.field.kindOnline')}</option>
                      <option value="local">{t('aiProviders.field.kindLocal')}</option>
                      <option value="custom">{t('aiProviders.field.kindCustom')}</option>
                    </Select>
                  </VStack>
                )}
              </HStack>

              <VStack gap="8" max className={styles.field}>
                <HStack gap="4" align="center">
                  <Label htmlFor="ai-provider-endpoint" className={styles.fieldLabel}>
                    {t('aiProviders.field.endpoint')} *
                  </Label>
                  <InfoTooltip text={t('aiProviders.field.endpointHint')} />
                </HStack>
                <Input
                  id="ai-provider-endpoint"
                  value={endpoint}
                  onChange={(event) => setEndpoint(event.target.value)}
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </VStack>

              {(!speechMode || customSpeech) && (
                <VStack gap="8" max className={styles.field}>
                  <HStack gap="4" align="center">
                    <Label htmlFor="ai-provider-auth" className={styles.fieldLabel}>
                      {t('aiProviders.field.authType')}
                    </Label>
                    <InfoTooltip text={t('aiProviders.field.authHint')} />
                  </HStack>
                  <Select
                    id="ai-provider-auth"
                    value={authType}
                    onChange={(event) => setAuthType(event.target.value as CatalogAuth)}
                  >
                    <option value="bearer">{t('aiProviders.field.authBearer')}</option>
                    <option value="none">{t('aiProviders.field.authNone')}</option>
                    <option value="custom">{t('aiProviders.field.authCustom')}</option>
                  </Select>
                </VStack>
              )}

              {(speechMode && !customSpeech || authType === 'bearer') && (
                <VStack gap="8" max className={styles.field}>
                  <HStack gap="4" align="center">
                    <Label htmlFor="ai-provider-key" className={styles.fieldLabel}>
                      {t('aiProviders.field.apiKey')}
                    </Label>
                    <InfoTooltip text={t('aiProviders.field.apiKeyHint')} />
                  </HStack>
                  <PasswordInput
                    id="ai-provider-key"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    autoComplete="new-password"
                    placeholder={provider?.has_key ? t('aiProviders.field.apiKeyStored') : ''}
                  />
                </VStack>
              )}

              {(!speechMode || customSpeech) && authType === 'custom' && (
                <VStack gap="8" max className={styles.field}>
                  <Label className={styles.fieldLabel}>{t('webhookAuth.customHeaders')}</Label>
                  {authHeaders.map((header, index) => (
                    <HStack key={index} gap="8" align="center" max>
                      <Input
                        aria-label={t('webhookAuth.headerKey')}
                        autoComplete="off"
                        placeholder={t('webhookAuth.headerKey')}
                        value={header.key}
                        onChange={(event) => setAuthHeaders((rows) => rows.map((row, i) => (
                          i === index ? { ...row, key: event.target.value } : row
                        )))}
                      />
                      <PasswordInput
                        aria-label={t('webhookAuth.headerValue')}
                        autoComplete="new-password"
                        placeholder={provider?.has_key ? t('aiProviders.field.apiKeyStored') : t('webhookAuth.headerValue')}
                        value={header.value}
                        onChange={(event) => setAuthHeaders((rows) => rows.map((row, i) => (
                          i === index ? { ...row, value: event.target.value } : row
                        )))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={t('common.delete', 'Удалить')}
                        onClick={() => setAuthHeaders((rows) => rows.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </HStack>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAuthHeaders((rows) => [...rows, { key: '', value: '' }])}
                  >
                    <Plus size={14} />
                    {t('webhookAuth.addHeader')}
                  </Button>
                </VStack>
              )}

              <SpeechCatalogFields
                vendor={vendor.trim()}
                caps={[cap]}
                custom={customSpeech}
                fields={speech}
                onChange={(key, value) => setSpeech((prev) => ({ ...prev, [key]: value }))}
                preview={cap === 'tts' && (isSpeechVendor(vendor) || customSpeech) ? {
                  disabled: !canPreviewVoice,
                  busy: previewState.isLoading,
                  hint: t(customSpeech
                    ? 'aiProviders.field.listenNeedsSave'
                    : 'aiProviders.field.listenNeedsKey'),
                  label: t('aiProviders.field.listen'),
                  onPreview: () => void handlePreview(),
                } : undefined}
              />

              {cap === 'llm' && (
                <VStack gap="8" max className={styles.field}>
                  <HStack gap="4" align="center">
                    <Label htmlFor="ai-provider-model" className={styles.fieldLabel}>
                      {t('aiProviders.field.model')}
                    </Label>
                    <InfoTooltip text={t('aiProviders.field.modelHint')} />
                  </HStack>
                  <Input
                    id="ai-provider-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                  />
                </VStack>
              )}

              <HStack gap="8" align="center">
                <Switch
                  id="ai-provider-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
                <Label htmlFor="ai-provider-enabled">{t('aiProviders.field.enabled')}</Label>
              </HStack>

              {error && (
                <Text className={styles.fieldError} role="alert">{error}</Text>
              )}
            </VStack>
          </div>

          <DialogFooter className={styles.footer}>
            <HStack gap="8" justify="end" max>
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className={styles.spin} /> : null}
                {t('common.save')}
              </Button>
            </HStack>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
