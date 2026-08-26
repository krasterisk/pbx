import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Mic, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { sttEnginesActions } from '@/features/stt-engines/model/slice/sttEnginesSlice';
import { SttEnginesTable } from '@/features/stt-engines/ui/SttEnginesTable/SttEnginesTable';
import cls from './SttEnginesPage.module.scss';

export function SttEnginesPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="stt-engines-page-responsive">
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4 min-w-0" max>
        <VStack gap="4" className="min-w-0">
          <HStack gap="12" align="center">
            <Mic className="w-7 h-7 text-primary shrink-0" />
            <Text variant="h1" className="text-2xl font-bold">{t('sttEngines.title', 'Распознавание речи (STT)')}</Text>
          </HStack>
          <Text variant="small" className="text-muted-foreground">
            {t('sttEngines.subtitle', 'Настройка движков распознавания речи')}
          </Text>
        </VStack>
        <Button
          className={cls.actionBtn}
          onClick={() => dispatch(sttEnginesActions.openCreateModal())}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('sttEngines.add', 'Добавить движок')}
        </Button>
      </HStack>

      {/* Table - D-29 page-level overflow hybrid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', minWidth: 0 }}
      >
        <div
          className={`${cls.tableScroll} overflow-x-auto`}
          data-testid="hybrid-table"
          data-hybrid="overflow-x-auto"
        >
          <SttEnginesTable />
        </div>
      </motion.div>
    </VStack>
  );
}
