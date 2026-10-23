import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, Button, InfoTooltip, Input, Label } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetServerConfigQuery, useUpdateServerConfigMutation } from '../../api/systemSettingsApi';
import cls from '../SettingsControls.module.scss';

export const RecordingsCard = memo(() => {
  const { t } = useTranslation();
  const { data, isLoading } = useGetServerConfigQuery();
  const [updateConfig, { isLoading: isSaving }] = useUpdateServerConfigMutation();
  const [basePath, setBasePath] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [pathEditable, setPathEditable] = useState(false);
  const [urlEditable, setUrlEditable] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  useEffect(() => {
    if (data) { setBasePath(data.records_base_path || ''); setBaseUrl(data.records_base_url || ''); }
  }, [data]);
  const handleSave = async () => {
    try {
      await updateConfig({ records_base_path: basePath, records_base_url: baseUrl }).unwrap();
      setResult({ ok: true, msg: t('systemSettings.recordingsSaved') });
    } catch { setResult({ ok: false, msg: t('systemSettings.recordingsSaveError') }); }
    setTimeout(() => setResult(null), 4000);
  };
  return <VStack gap="12" align="stretch" className={cls.form}>
    <VStack gap="6" align="stretch" className={cls.field}>
      <HStack gap="4" align="center"><Label htmlFor="settings-records-path" className={cls.label}>{t('systemSettings.recordingsBasePath')}</Label><InfoTooltip text={t('systemSettings.recordingsBasePathDesc')} /></HStack>
      <Input id="settings-records-path" name="krsk-records-base-path" value={basePath} onChange={e => setBasePath(e.target.value)} placeholder="/usr/records" disabled={isLoading || isSaving} autoComplete="off" autoCapitalize="off" spellCheck={false} readOnly={!pathEditable} onFocus={() => setPathEditable(true)} data-1p-ignore="true" data-lpignore="true" />
    </VStack>
    <VStack gap="6" align="stretch" className={cls.field}>
      <HStack gap="4" align="center"><Label htmlFor="settings-records-url" className={cls.label}>{t('systemSettings.recordingsBaseUrl')}</Label><InfoTooltip text={t('systemSettings.recordingsBaseUrlDesc')} /></HStack>
      <Input id="settings-records-url" name="krsk-records-base-url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://pbx.example.com/records" disabled={isLoading || isSaving} autoComplete="off" autoCapitalize="off" spellCheck={false} readOnly={!urlEditable} onFocus={() => setUrlEditable(true)} data-1p-ignore="true" data-lpignore="true" />
    </VStack>
    <HStack gap="12" wrap="wrap" align="center">
      <Button size="sm" onClick={handleSave} disabled={isSaving || isLoading}>{t(isSaving ? 'systemSettings.recordingsSaving' : 'systemSettings.recordingsSaveBtn')}</Button>
      {result && <Text role={result.ok ? 'status' : 'alert'} variant={result.ok ? 'success' : 'error'}>{result.msg}</Text>}
    </HStack>
  </VStack>;
});
RecordingsCard.displayName = 'RecordingsCard';
