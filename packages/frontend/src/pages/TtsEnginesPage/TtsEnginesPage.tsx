import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { AudioLines, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { ttsEnginesActions } from '@/features/tts-engines/model/slice/ttsEnginesSlice';
import { TtsEnginesTable } from '@/features/tts-engines/ui/TtsEnginesTable/TtsEnginesTable';

export function TtsEnginesPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <AudioLines className="w-7 h-7 text-primary" />
            <Text variant="h1" className="text-2xl font-bold">{t('ttsEngines.title', 'Синтез речи (TTS)')}</Text>
          </HStack>
          <Text variant="small" className="text-muted-foreground">
            {t('ttsEngines.subtitle', 'Настройка движков синтеза речи')}
          </Text>
        </VStack>
        <Button onClick={() => dispatch(ttsEnginesActions.openCreateModal())}>
          <Plus className="w-4 h-4 mr-2" />
          {t('ttsEngines.add', 'Добавить движок')}
        </Button>
      </HStack>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <TtsEnginesTable />
      </motion.div>
    </VStack>
  );
}
