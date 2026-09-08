import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Loader2 } from 'lucide-react';
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
  useUpdateAiProviderMutation,
  type AiCapability,
  type AiProviderKind,
  type IAiProvider,
} from '@/shared/api/endpoints/aiAgentsApi';
import styles from './AiProviderModal.module.scss';

interface Props {
  provider: IAiProvider | null;
  onClose: () => void;
}

const ALL_CAPS: AiCapability[] = ['llm', 'stt', 'tts', 'realtime'];

const CAP_KEYS: Record<AiCapability, string> = {
  llm: 'aiProviders.field.capLlm',
  stt: 'aiProviders.field.capStt',
  tts: 'aiProviders.field.capTts',
  realtime: 'aiProviders.field.capRealtime',
  tools: 'aiProviders.field.capLlm',
  function_calling: 'aiProviders.field.capLlm',
};

export function AiProviderModal({ provider, onClose }: Props) {
  const { t } = useTranslation();
  const isEdit = !!provider;

  const [name, setName] = useState(provider?.name ?? '');
  const [vendor, setVendor] = useState(provider?.vendor ?? '');
  const [kind, setKind] = useState<AiProviderKind>(provider?.kind ?? 'online');
  const [endpoint, setEndpoint] = useState(provider?.endpoint ?? '');
  const [authType, setAuthType] = useState(provider?.auth_type || 'bearer');
  const [apiKey, setApiKey] = useState('');
  const [caps, setCaps] = useState<AiCapability[]>(provider?.capabilities ?? ['llm']);
  const [enabled, setEnabled] = useState(provider?.enabled !== false);
  const [model, setModel] = useState(
    typeof provider?.defaults?.model === 'string' ? provider.defaults.model : '',
  );
  const [inputUsd, setInputUsd] = useState(String(provider?.pricing?.inputTokenUsd ?? 0));
  const [outputUsd, setOutputUsd] = useState(String(provider?.pricing?.outputTokenUsd ?? 0));
  const [extraOpen, setExtraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createProvider, { isLoading: isCreating }] = useCreateAiProviderMutation();
  const [updateProvider, { isLoading: isUpdating }] = useUpdateAiProviderMutation();
  const submitting = isCreating || isUpdating;

  const toggleCap = (cap: AiCapability) => {
    setCaps((prev) => (prev.includes(cap) ? prev.filter((item) => item !== cap) : [...prev, cap]));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError(t('aiProviders.error.nameRequired'));
    if (!endpoint.trim()) return setError(t('aiProviders.error.endpointRequired'));
    if (caps.length === 0) return setError(t('aiProviders.error.capsRequired'));

    const payload = {
      name: name.trim(),
      vendor: vendor.trim() || 'custom',
      kind,
      endpoint: endpoint.trim(),
      auth_type: authType,
      capabilities: caps,
      defaults: {
        ...(provider?.defaults ?? {}),
        ...(model.trim() ? { model: model.trim() } : {}),
      },
      pricing: {
        ...(provider?.pricing ?? {}),
        inputTokenUsd: Number(inputUsd) || 0,
        outputTokenUsd: Number(outputUsd) || 0,
      },
      enabled,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
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
        className={`flex flex-col gap-0 overflow-hidden max-h-[min(90vh,90dvh)] ${styles.dialogContent}`}
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

              <HStack gap="16" className={styles.row} max>
                <VStack gap="8" max className={styles.field}>
                  <HStack gap="4" align="center">
                    <Label htmlFor="ai-provider-vendor" className={styles.fieldLabel}>
                      {t('aiProviders.field.vendor')}
                    </Label>
                    <InfoTooltip text={t('aiProviders.field.vendorHint')} />
                  </HStack>
                  <Input
                    id="ai-provider-vendor"
                    value={vendor}
                    onChange={(event) => setVendor(event.target.value)}
                  />
                </VStack>
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

              <HStack gap="16" className={styles.row} max>
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
                    onChange={(event) => setAuthType(event.target.value)}
                  >
                    <option value="bearer">{t('aiProviders.field.authBearer')}</option>
                    <option value="api_key_header">{t('aiProviders.field.authHeader')}</option>
                    <option value="none">{t('aiProviders.field.authNone')}</option>
                    <option value="custom">{t('aiProviders.field.authCustom')}</option>
                  </Select>
                </VStack>
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
                  />
                </VStack>
              </HStack>

              <VStack gap="8" max className={styles.field}>
                <HStack gap="4" align="center">
                  <Label className={styles.fieldLabel}>{t('aiProviders.field.capabilities')}</Label>
                  <InfoTooltip text={t('aiProviders.field.capabilitiesHint')} />
                </HStack>
                <HStack gap="8" className={styles.caps} max>
                  {ALL_CAPS.map((cap) => (
                    <Button
                      key={cap}
                      type="button"
                      variant={caps.includes(cap) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleCap(cap)}
                    >
                      {t(CAP_KEYS[cap])}
                    </Button>
                  ))}
                </HStack>
              </VStack>

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

              <HStack gap="8" align="center">
                <Switch
                  id="ai-provider-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
                <Label htmlFor="ai-provider-enabled">{t('aiProviders.field.enabled')}</Label>
              </HStack>

              <VStack gap="12" max className={styles.extra}>
                <HStack justify="between" align="center" max>
                  <HStack gap="4" align="center">
                    <Text className={styles.extraTitle}>{t('aiProviders.extra')}</Text>
                    <InfoTooltip text={t('aiProviders.extraTooltip')} />
                  </HStack>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-expanded={extraOpen}
                    aria-controls="ai-provider-extra"
                    title={t('aiProviders.extra')}
                    aria-label={t('aiProviders.extra')}
                    onClick={() => setExtraOpen((open) => !open)}
                  >
                    <ChevronDown className={extraOpen ? styles.chevronOpen : styles.chevron} />
                  </Button>
                </HStack>
                {extraOpen && (
                  <HStack gap="16" className={styles.row} max id="ai-provider-extra">
                    <VStack gap="8" max className={styles.field}>
                      <Label htmlFor="ai-provider-in" className={styles.fieldLabel}>
                        {t('aiProviders.field.inputTokenUsd')}
                      </Label>
                      <Input
                        id="ai-provider-in"
                        inputMode="decimal"
                        value={inputUsd}
                        onChange={(event) => setInputUsd(event.target.value)}
                      />
                    </VStack>
                    <VStack gap="8" max className={styles.field}>
                      <Label htmlFor="ai-provider-out" className={styles.fieldLabel}>
                        {t('aiProviders.field.outputTokenUsd')}
                      </Label>
                      <Input
                        id="ai-provider-out"
                        inputMode="decimal"
                        value={outputUsd}
                        onChange={(event) => setOutputUsd(event.target.value)}
                      />
                    </VStack>
                  </HStack>
                )}
              </VStack>

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
