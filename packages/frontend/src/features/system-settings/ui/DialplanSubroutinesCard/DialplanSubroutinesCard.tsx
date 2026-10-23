import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Text, Button, InfoTooltip } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useApplySubroutinesMutation } from '../../api/systemSettingsApi';
import cls from '../SettingsControls.module.scss';

export const DialplanSubroutinesCard = () => {
  const { t } = useTranslation();
  const [applySubroutines, { isLoading }] = useApplySubroutinesMutation();
  const [result, setResult] = useState<{ success: boolean; linesApplied?: number; error?: string } | null>(null);
  const handleApply = async () => {
    setResult(null);
    try { setResult(await applySubroutines().unwrap()); }
    catch (e: unknown) { setResult({ success: false, error: (e as { data?: { message?: string } })?.data?.message || t('systemSettings.applyError') }); }
  };
  return <VStack gap="12" className={cls.form}>
    <HStack gap="12" wrap="wrap" align="center" justify="between" max>
      <VStack gap="6" className={cls.grow}>
        <HStack gap="4" align="center"><Text variant="small">{t('systemSettings.subroutinesTitle')}</Text><InfoTooltip text={t('systemSettings.subroutinesDesc')} /></HStack>
        <Text variant="muted">{t('systemSettings.subroutinesFile')}: <Text as="code" className={cls.code}>krasterisk/subroutines.conf</Text></Text>
      </VStack>
      <Button size="sm" id="apply-subroutines-btn" onClick={handleApply} disabled={isLoading} className={cls.action}>
        <RefreshCw className={`${cls.icon} ${isLoading ? cls.spin : ''}`} />{t(isLoading ? 'systemSettings.applying' : 'systemSettings.applyBtn')}
      </Button>
    </HStack>
    {result && <Text role={result.success ? 'status' : 'alert'} variant={result.success ? 'success' : 'error'}>{result.success ? t('systemSettings.applySuccess', { count: result.linesApplied ?? 0 }) : result.error || t('systemSettings.applyError')}</Text>}
  </VStack>;
};
