import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { FileCode2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Text, Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useApplySubroutinesMutation } from '@/features/system-settings/api/systemSettingsApi';
import cls from './DialplanSubroutinesCard.module.scss';

export const DialplanSubroutinesCard = () => {
  const { t } = useTranslation();
  const [applySubroutines, { isLoading }] = useApplySubroutinesMutation();
  const [result, setResult] = useState<{ success: boolean; linesApplied?: number; error?: string } | null>(null);

  const handleApply = async () => {
    setResult(null);
    try {
      const res = await applySubroutines().unwrap();
      setResult(res);
    } catch (e: any) {
      setResult({ success: false, error: e?.data?.message || t('systemSettings.applyError') });
    }
  };

  return (
    <VStack className={cls.card}>
      <HStack justify="between" align="center" className={cls.cardBody} max>
        <HStack gap="12" align="center" className={cls.info}>
          <VStack align="center" justify="center" className={cls.iconWrap}>
            <FileCode2 className={cls.icon} />
          </VStack>
          <VStack gap="4">
            <Text className={cls.title}>{t('systemSettings.subroutinesTitle')}</Text>
            <Text variant="small" className={cls.desc}>
              {t('systemSettings.subroutinesDesc')}
            </Text>
            <Text variant="small" className={cls.filePath}>
              {t('systemSettings.subroutinesFile')}: <span className={cls.code}>krasterisk/subroutines.conf</span>
            </Text>
          </VStack>
        </HStack>

        <Button
          id="apply-subroutines-btn"
          onClick={handleApply}
          disabled={isLoading}
          className={cls.applyBtn}
        >
          <RefreshCw className={`${cls.btnIcon} ${isLoading ? cls.spin : ''}`} />
          {isLoading ? t('systemSettings.applying') : t('systemSettings.applyBtn')}
        </Button>
      </HStack>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`${cls.result} ${result.success ? cls.resultOk : cls.resultErr}`}
          >
            <HStack gap="8" align="center">
              {result.success
                ? <CheckCircle2 className={cls.resultIcon} />
                : <XCircle className={cls.resultIcon} />
              }
              <Text variant="small">
                {result.success
                  ? t('systemSettings.applySuccess', { count: result.linesApplied ?? 0 })
                  : result.error || t('systemSettings.applyError')
                }
              </Text>
            </HStack>
          </motion.div>
        )}
      </AnimatePresence>
    </VStack>
  );
};
