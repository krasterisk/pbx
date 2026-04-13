import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Mic, Plus } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { sttEnginesActions } from '@/features/stt-engines/model/slice/sttEnginesSlice';
import { SttEnginesTable } from '@/features/stt-engines/ui/SttEnginesTable/SttEnginesTable';

export function SttEnginesPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <Mic className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">{t('sttEngines.title', 'Распознавание речи (STT)')}</h1>
          </HStack>
          <p className="text-muted-foreground text-sm">
            {t('sttEngines.subtitle', 'Настройка движков распознавания речи')}
          </p>
        </VStack>
        <Button onClick={() => dispatch(sttEnginesActions.openCreateModal())}>
          <Plus className="w-4 h-4 mr-2" />
          {t('sttEngines.add', 'Добавить движок')}
        </Button>
      </HStack>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <SttEnginesTable />
      </motion.div>
    </VStack>
  );
}


