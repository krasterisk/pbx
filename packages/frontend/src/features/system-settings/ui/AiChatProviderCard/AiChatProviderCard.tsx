import { memo, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Text, Button, Select, Switch, InfoTooltip } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectIsAdmin, selectIsSuperAdmin } from '@/entities/User';
import { useGetAiProvidersQuery } from '@/shared/api/endpoints/aiAgentsApi';
import {
  useGetAiChatDefaultProviderQuery,
  useUpdateAiChatDefaultProviderMutation,
  useGetAiChatSettingsQuery,
  useUpdateAiChatSettingsMutation,
} from '@/shared/api/endpoints/aiChatApi';
import cls from './AiChatProviderCard.module.scss';

export const AiChatProviderCard = memo(() => {
  const { t } = useTranslation();
  const isAdmin = useAppSelector(selectIsAdmin);
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);
  const canSeeAllThreads = isAdmin || isSuperAdmin;
  const { data: providers = [], isLoading } = useGetAiProvidersQuery();
  const { data: defaultProvider } = useGetAiChatDefaultProviderQuery();
  const [saveDefaultProvider] = useUpdateAiChatDefaultProviderMutation();
  const { data: settings } = useGetAiChatSettingsQuery(undefined, { skip: !canSeeAllThreads });
  const [updateSettings] = useUpdateAiChatSettingsMutation();

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

  return (
    <div className={cls.card} data-testid="ai-chat-provider-card">
      <VStack gap="12" max>
        <Text variant="muted" className={cls.desc}>
          {t('systemSettings.aiChatProviderDesc')}
        </Text>
        {llmProviders.length === 0 ? (
          <Text variant="muted" data-testid="ai-chat-provider-empty">
            {t('systemSettings.aiChatProviderEmpty')}
          </Text>
        ) : (
          <HStack gap="8" align="center" className="flex-col sm:flex-row" max>
            <Select
              value={chatProviderUid === '' ? '' : String(chatProviderUid)}
              onChange={(event) => setChatProviderUid(Number(event.target.value))}
              disabled={isLoading}
              data-testid="ai-chat-provider"
              className={cls.input}
            >
              <option value="" disabled>
                {t('systemSettings.aiChatProvider')}
              </option>
              {llmProviders.map((row) => {
                const modelName = typeof row.defaults?.model === 'string' ? row.defaults.model : null;
                return (
                  <option key={row.uid} value={row.uid}>
                    {row.name}{modelName ? ` · ${modelName}` : ''}
                  </option>
                );
              })}
            </Select>
            <Button
              size="sm"
              type="button"
              disabled={chatProviderUid === ''}
              data-testid="ai-chat-provider-save"
              className={cls.saveBtn}
              onClick={() => {
                if (chatProviderUid === '') return;
                void saveDefaultProvider({ providerUid: chatProviderUid })
                  .unwrap()
                  .then(() => showFeedback(true, t('systemSettings.aiChatProviderSaved')))
                  .catch(() => showFeedback(false, t('systemSettings.aiPbxSaveError')));
              }}
            >
              {t('systemSettings.recordingsSaveBtn')}
            </Button>
          </HStack>
        )}
        {canSeeAllThreads && (
          <HStack gap="16" align="start" justify="between" max className={cls.seeAllRow}>
            <VStack gap="4">
              <HStack gap="4" align="center">
                <Text>{t('systemSettings.aiChatSeeAllThreads')}</Text>
                <InfoTooltip text={t('systemSettings.aiChatSeeAllThreadsHint')} />
              </HStack>
            </VStack>
            <Switch
              id="ai-chat-see-all-threads"
              disabled={settings === undefined}
              checked={settings?.seeAllThreads ?? false}
              onCheckedChange={(next) => {
                void updateSettings({ seeAllThreads: next })
                  .unwrap()
                  .catch(() => showFeedback(false, t('systemSettings.aiPbxSaveError')));
              }}
              aria-label={t('systemSettings.aiChatSeeAllThreads')}
            />
          </HStack>
        )}
        <HStack gap="12" align="center" justify="between" max>
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className={cls.result}
              >
                {result.ok
                  ? <CheckCircle2 className={cls.iconOk} />
                  : <XCircle className={cls.iconErr} />}
                <Text variant="small">{result.msg}</Text>
              </motion.div>
            )}
          </AnimatePresence>
          <Link to="/ai-providers" className={cls.link} data-testid="ai-chat-all-providers">
            {t('systemSettings.aiPbxAllProviders')}
          </Link>
        </HStack>
      </VStack>
    </div>
  );
});

AiChatProviderCard.displayName = 'AiChatProviderCard';
