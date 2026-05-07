import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { HardDrive, Link2, CheckCircle2, XCircle } from 'lucide-react';
import { Text, Button, Input } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useGetServerConfigQuery,
  useUpdateServerConfigMutation,
} from '@/features/system-settings/api/systemSettingsApi';
import cls from './RecordingsCard.module.scss';

export const RecordingsCard = memo(() => {
  const { t } = useTranslation();
  const { data, isLoading } = useGetServerConfigQuery();
  const [updateConfig, { isLoading: isSaving }] = useUpdateServerConfigMutation();

  const [basePath, setBasePath] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Sync form from loaded data
  useEffect(() => {
    if (data) {
      setBasePath(data.records_base_path || '');
      setBaseUrl(data.records_base_url || '');
    }
  }, [data]);

  const handleSave = async () => {
    try {
      await updateConfig({ records_base_path: basePath, records_base_url: baseUrl }).unwrap();
      setResult({ ok: true, msg: t('systemSettings.recordingsSaved') });
    } catch {
      setResult({ ok: false, msg: t('systemSettings.recordingsSaveError') });
    }
    setTimeout(() => setResult(null), 4000);
  };

  return (
    <div className={cls.card}>
      <VStack gap="16" max>
        {/* Disk path */}
        <VStack gap="6" max>
          <HStack gap="8" align="center">
            <HardDrive className={cls.fieldIcon} />
            <Text variant="small" className={cls.label}>{t('systemSettings.recordingsBasePath')}</Text>
          </HStack>
          <Text variant="muted" className={cls.desc}>{t('systemSettings.recordingsBasePathDesc')}</Text>
          <Input
            value={basePath}
            onChange={(e) => setBasePath(e.target.value)}
            placeholder="/usr/records"
            disabled={isLoading}
            className={cls.input}
          />
        </VStack>

        {/* Public URL */}
        <VStack gap="6" max>
          <HStack gap="8" align="center">
            <Link2 className={cls.fieldIcon} />
            <Text variant="small" className={cls.label}>{t('systemSettings.recordingsBaseUrl')}</Text>
          </HStack>
          <Text variant="muted" className={cls.desc}>{t('systemSettings.recordingsBaseUrlDesc')}</Text>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://pbx.example.com/records"
            disabled={isLoading}
            className={cls.input}
          />
        </VStack>

        {/* Footer */}
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
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className={cls.saveBtn}
          >
            {isSaving ? t('systemSettings.recordingsSaving') : t('systemSettings.recordingsSaveBtn')}
          </Button>
        </HStack>
      </VStack>
    </div>
  );
});

RecordingsCard.displayName = 'RecordingsCard';
