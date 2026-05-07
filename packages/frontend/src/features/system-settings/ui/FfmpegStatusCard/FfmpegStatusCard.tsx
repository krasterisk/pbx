import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, RefreshCw, Terminal } from 'lucide-react';
import { Text, Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useLazyGetFfmpegStatusQuery } from '@/features/system-settings/api/systemSettingsApi';
import cls from './FfmpegStatusCard.module.scss';

export const FfmpegStatusCard = memo(() => {
  const { t } = useTranslation();
  const [trigger, { data, isFetching }] = useLazyGetFfmpegStatusQuery();
  const [checked, setChecked] = useState(false);

  const handleCheck = async () => {
    setChecked(true);
    await trigger();
  };

  return (
    <div className={cls.card}>
      <HStack gap="16" align="center" justify="between" max>
        {/* Status area */}
        <div className={cls.statusArea}>
          <AnimatePresence mode="wait">
            {!checked && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cls.idle}
              >
                <Terminal className={cls.idleIcon} />
                <Text variant="muted">{t('systemSettings.sectionFfmpegDesc')}</Text>
              </motion.div>
            )}
            {checked && !isFetching && data && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={data.available ? cls.resultOk : cls.resultErr}
              >
                {data.available
                  ? <CheckCircle2 className={cls.iconOk} />
                  : <XCircle className={cls.iconErr} />}
                <VStack gap="2">
                  <Text variant="small" className={data.available ? cls.textOk : cls.textErr}>
                    {data.available
                      ? t('systemSettings.ffmpegAvailable')
                      : t('systemSettings.ffmpegNotAvailable')}
                  </Text>
                  {data.available && data.version && (
                    <Text variant="muted" className={cls.version}>
                      {t('systemSettings.ffmpegVersion')}: <code className={cls.code}>{data.version}</code>
                    </Text>
                  )}
                  {!data.available && data.error && (
                    <Text variant="muted" className={cls.errorText}>{data.error}</Text>
                  )}
                  {!data.available && (
                    <Text variant="muted" className={cls.hint}>{t('systemSettings.ffmpegInstallHint')}</Text>
                  )}
                </VStack>
              </motion.div>
            )}
            {isFetching && (
              <motion.div key="loading" className={cls.idle}>
                <RefreshCw className={`${cls.idleIcon} ${cls.spin}`} />
                <Text variant="muted">{t('systemSettings.ffmpegChecking')}</Text>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Check button */}
        <Button
          size="sm"
          variant="outline"
          onClick={handleCheck}
          disabled={isFetching}
          className={cls.checkBtn}
        >
          <RefreshCw className={`${cls.btnIcon} ${isFetching ? cls.spin : ''}`} />
          {isFetching ? t('systemSettings.ffmpegChecking') : t('systemSettings.ffmpegCheck')}
        </Button>
      </HStack>
    </div>
  );
});

FfmpegStatusCard.displayName = 'FfmpegStatusCard';
