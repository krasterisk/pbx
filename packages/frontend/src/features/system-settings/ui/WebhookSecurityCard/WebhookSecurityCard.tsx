import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Text, Button, InfoTooltip, Label, PasswordInput } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetServerConfigQuery, useUpdateServerConfigMutation } from '../../api/systemSettingsApi';
import cls from '../SettingsControls.module.scss';
const MASK = '••••••••';
function generateSecret(): string {
  const array = new Uint8Array(32); crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
export const WebhookSecurityCard = memo(() => {
  const { t } = useTranslation();
  const { data, isLoading } = useGetServerConfigQuery();
  const [updateConfig, { isLoading: isSaving }] = useUpdateServerConfigMutation();
  const isSetOnServer = data?.webhook_secret === MASK;
  const [secret, setSecret] = useState('');
  const [secretEditable, setSecretEditable] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const showFeedback = (ok: boolean, msg: string) => { setResult({ ok, msg }); setTimeout(() => setResult(null), 4000); };
  const handleSave = useCallback(async () => {
    if (!secret.trim()) return;
    try { await updateConfig({ webhook_secret: secret.trim() }).unwrap(); setSecret(''); showFeedback(true, t('systemSettings.webhookSecretSaved')); }
    catch { showFeedback(false, t('systemSettings.recordingsSaveError')); }
  }, [secret, updateConfig, t]);
  const handleClear = useCallback(async () => {
    try { await updateConfig({ webhook_secret: '' }).unwrap(); setSecret(''); showFeedback(true, t('systemSettings.webhookSecretCleared')); }
    catch { showFeedback(false, t('systemSettings.recordingsSaveError')); }
  }, [updateConfig, t]);
  return <VStack gap="12" align="stretch" className={cls.form}>
    <VStack gap="6" align="stretch" className={cls.field}>
      <HStack gap="4" align="center"><Label htmlFor="settings-webhook-secret" className={cls.label}>{t('systemSettings.webhookSecretLabel')}</Label><InfoTooltip text={t('systemSettings.webhookSecretDesc')} /></HStack>
      <HStack gap="8" align="center" max>
        <VStack className={cls.grow} align="stretch"><PasswordInput id="settings-webhook-secret" name="krsk-webhook-secret" value={secret} onChange={e => setSecret(e.target.value)} placeholder={isSetOnServer ? MASK : t('systemSettings.webhookSecretPlaceholder')} disabled={isLoading || isSaving} autoComplete="new-password" autoCapitalize="off" spellCheck={false} readOnly={!secretEditable} onFocus={() => setSecretEditable(true)} data-1p-ignore="true" data-lpignore="true" /></VStack>
        <Button size="icon" variant="outline" onClick={() => setSecret(generateSecret())} disabled={isSaving} aria-label={t('systemSettings.webhookSecretGenerate')} className={cls.action}><RefreshCw className={cls.icon} /></Button>
      </HStack>
      <Text variant="muted" role="status">{t(isSetOnServer ? 'systemSettings.webhookSecretIsSet' : 'systemSettings.webhookSecretNotSet')}</Text>
    </VStack>
    <HStack gap="12" wrap="wrap" align="center">
      <Button size="sm" onClick={handleSave} disabled={isSaving || !secret.trim()}>{t(isSaving ? 'systemSettings.webhookSecretSaving' : 'systemSettings.webhookSecretSaveBtn')}</Button>
      {isSetOnServer && <Button size="sm" variant="ghost" onClick={handleClear} disabled={isSaving}>{t('systemSettings.webhookSecretClear')}</Button>}
      {result && <Text role={result.ok ? 'status' : 'alert'} variant={result.ok ? 'success' : 'error'}>{result.msg}</Text>}
    </HStack>
  </VStack>;
});
WebhookSecurityCard.displayName = 'WebhookSecurityCard';
