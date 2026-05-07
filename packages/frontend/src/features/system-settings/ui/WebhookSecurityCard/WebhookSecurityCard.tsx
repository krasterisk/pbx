import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ShieldOff, RefreshCw, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { Text, Button, Input } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useGetServerConfigQuery,
  useUpdateServerConfigMutation,
} from '@/features/system-settings/api/systemSettingsApi';
import cls from './WebhookSecurityCard.module.scss';

const MASK = '••••••••';

/** Cryptographically random 32-byte hex secret */
function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const WebhookSecurityCard = memo(() => {
  const { t } = useTranslation();
  const { data, isLoading } = useGetServerConfigQuery();
  const [updateConfig, { isLoading: isSaving }] = useUpdateServerConfigMutation();

  // If data.webhook_secret === MASK → secret is set on server (don't modify until user types)
  const isSetOnServer = data?.webhook_secret === MASK;
  const [secret, setSecret] = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const showFeedback = (ok: boolean, msg: string) => {
    setResult({ ok, msg });
    setTimeout(() => setResult(null), 4000);
  };

  const handleSave = useCallback(async () => {
    if (!secret.trim()) return;
    try {
      await updateConfig({ webhook_secret: secret.trim() }).unwrap();
      setSecret('');
      showFeedback(true, t('systemSettings.webhookSecretSaved'));
    } catch {
      showFeedback(false, t('systemSettings.recordingsSaveError'));
    }
  }, [secret, updateConfig, t]);

  const handleGenerate = useCallback(() => {
    setSecret(generateSecret());
  }, []);

  const handleClear = useCallback(async () => {
    try {
      await updateConfig({ webhook_secret: '' }).unwrap();
      setSecret('');
      showFeedback(true, t('systemSettings.webhookSecretCleared'));
    } catch {
      showFeedback(false, t('systemSettings.recordingsSaveError'));
    }
  }, [updateConfig, t]);

  return (
    <div className={cls.card}>
      <VStack gap="16" max>
        {/* Status badge */}
        <HStack gap="8" align="center">
          {isSetOnServer
            ? <ShieldCheck className={cls.iconSet} />
            : <ShieldOff className={cls.iconNotSet} />}
          <Text variant="small" className={isSetOnServer ? cls.statusSet : cls.statusNotSet}>
            {isSetOnServer
              ? t('systemSettings.webhookSecretIsSet')
              : t('systemSettings.webhookSecretNotSet')}
          </Text>
        </HStack>

        {/* Description */}
        <Text variant="muted" className={cls.desc}>
          {t('systemSettings.webhookSecretDesc')}
        </Text>

        {/* Input + actions */}
        <VStack gap="8" max>
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={isSetOnServer ? MASK : t('systemSettings.webhookSecretPlaceholder')}
            disabled={isLoading || isSaving}
            className={cls.input}
          />
          <HStack gap="8" align="center" max>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={isSaving}
              className={cls.actionBtn}
            >
              <RefreshCw className={cls.btnIcon} />
              {t('systemSettings.webhookSecretGenerate')}
            </Button>
            {isSetOnServer && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClear}
                disabled={isSaving}
                className={cls.clearBtn}
              >
                <Trash2 className={cls.btnIcon} />
                {t('systemSettings.webhookSecretClear')}
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !secret.trim()}
              className={cls.saveBtn}
            >
              {isSaving ? t('systemSettings.webhookSecretSaving') : t('systemSettings.webhookSecretSaveBtn')}
            </Button>
          </HStack>
        </VStack>

        {/* Feedback */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
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
      </VStack>
    </div>
  );
});

WebhookSecurityCard.displayName = 'WebhookSecurityCard';
