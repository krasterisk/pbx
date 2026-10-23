import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Text, Button, InfoTooltip } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useLazyGetFfmpegStatusQuery } from '../../api/systemSettingsApi';
import cls from '../SettingsControls.module.scss';

export const FfmpegStatusCard = memo(() => {
  const { t } = useTranslation();
  const [trigger, { data, isFetching, isError }] = useLazyGetFfmpegStatusQuery();
  const [checked, setChecked] = useState(false);
  return <HStack gap="12" wrap="wrap" align="center" justify="between" className={cls.form}>
    <VStack gap="6" className={cls.grow}>
      {isFetching ? <Text variant="muted" role="status">{t('systemSettings.ffmpegChecking')}</Text>
        : isError ? <Text variant="error" role="alert">{t('systemSettings.statusCheckError')}</Text>
          : checked && data ? <>
            <HStack gap="4" align="center"><Text variant={data.available ? 'success' : 'error'} role="status">{t(data.available ? 'systemSettings.ffmpegAvailable' : 'systemSettings.ffmpegNotAvailable')}</Text>{!data.available && <InfoTooltip text={t('systemSettings.ffmpegInstallHint')} />}</HStack>
            {data.available && data.version && <Text variant="muted">{t('systemSettings.ffmpegVersion')}: <Text as="code" className={cls.code}>{data.version}</Text></Text>}
            {!data.available && data.error && <Text variant="error">{data.error}</Text>}
          </> : <Text variant="muted">{t('systemSettings.statusNotChecked')}</Text>}
    </VStack>
    <Button size="sm" variant="outline" onClick={async () => { setChecked(true); await trigger(); }} disabled={isFetching} className={cls.action}>
      <RefreshCw className={`${cls.icon} ${isFetching ? cls.spin : ''}`} />{t(isFetching ? 'systemSettings.ffmpegChecking' : 'systemSettings.ffmpegCheck')}
    </Button>
  </HStack>;
});
FfmpegStatusCard.displayName = 'FfmpegStatusCard';
