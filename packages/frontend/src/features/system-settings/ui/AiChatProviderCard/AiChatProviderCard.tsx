import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Text, Button, Select, Label, InfoTooltip } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectIsAdmin } from '@/entities/User';
import { useGetAiProvidersQuery } from '@/shared/api/endpoints/aiAgentsApi';
import {
  useGetAiChatDefaultProviderQuery,
  useUpdateAiChatDefaultProviderMutation,
} from '@/shared/api/endpoints/aiChatApi';
import cls from '../SettingsControls.module.scss';

export const AiChatProviderCard = memo(({ ownModels }: { ownModels: boolean }) => {
  const { t } = useTranslation();
  const isAdmin = useAppSelector(selectIsAdmin);
  const { data: providers = [], isLoading } = useGetAiProvidersQuery(undefined, {
    skip: !ownModels || !isAdmin,
  });
  const { data: defaultProvider } = useGetAiChatDefaultProviderQuery(undefined, {
    skip: !ownModels || !isAdmin,
  });
  const [saveDefaultProvider] = useUpdateAiChatDefaultProviderMutation();

  const [chatProviderUid, setChatProviderUid] = useState<number | ''>('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const llmProviders = useMemo(
    () => providers.filter((row) => row.enabled && row.capabilities.includes('llm')),
    [providers],
  );

  useEffect(() => {
    if (defaultProvider?.providerUid) {
      setChatProviderUid(defaultProvider.providerUid);
      return;
    }
    if (llmProviders[0]) setChatProviderUid(llmProviders[0].uid);
  }, [defaultProvider, llmProviders]);

  const showFeedback = (ok: boolean, msg: string) => {
    setResult({ ok, msg });
    setTimeout(() => setResult(null), 4000);
  };

  if (!ownModels || !isAdmin) return null;

  return (
    <VStack gap="12" align="stretch" className={cls.form} data-testid="ai-chat-provider-card">
      <VStack gap="6" align="stretch" className={cls.field}>
        <HStack gap="4" align="center"><Label htmlFor="settings-chat-provider" className={cls.label}>{t('systemSettings.aiChatProvider')}</Label><InfoTooltip text={t('systemSettings.aiChatProviderDesc')} /></HStack>
        {llmProviders.length === 0 ? <Text variant="muted" data-testid="ai-chat-provider-empty">{t('systemSettings.aiChatProviderEmpty')}</Text> :
          <HStack gap="8" align="center" className={cls.responsive} max>
            <Select id="settings-chat-provider" value={chatProviderUid === '' ? '' : String(chatProviderUid)} onChange={event => setChatProviderUid(Number(event.target.value))} disabled={isLoading} data-testid="ai-chat-provider" className={cls.grow}>
              <option value="" disabled>{t('systemSettings.aiChatProvider')}</option>
              {llmProviders.map(row => {
                const modelName = typeof row.defaults?.model === 'string' ? row.defaults.model : null;
                return <option key={row.uid} value={row.uid}>{row.name}{modelName ? ` · ${modelName}` : ''}</option>;
              })}
            </Select>
            <Button size="sm" type="button" disabled={chatProviderUid === ''} data-testid="ai-chat-provider-save" className={cls.action} onClick={() => {
              if (chatProviderUid === '') return;
              void saveDefaultProvider({ providerUid: chatProviderUid }).unwrap().then(() => showFeedback(true, t('systemSettings.aiChatProviderSaved'))).catch(() => showFeedback(false, t('systemSettings.aiPbxSaveError')));
            }}>{t('systemSettings.recordingsSaveBtn')}</Button>
          </HStack>}
      </VStack>
      <HStack gap="12" align="center" wrap="wrap">
        <Link to="/ai-providers" className={cls.link} data-testid="ai-chat-all-providers">{t('systemSettings.aiPbxAllProviders')}</Link>
        {result && <Text role={result.ok ? 'status' : 'alert'} variant={result.ok ? 'success' : 'error'}>{result.msg}</Text>}
      </HStack>
    </VStack>
  );
});
AiChatProviderCard.displayName = 'AiChatProviderCard';
