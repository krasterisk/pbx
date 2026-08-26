import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Volume2, Upload, Phone, FileAudio } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { promptsActions } from '@/features/prompts/model/slice/promptsSlice';
import { PromptsTable } from '@/features/prompts/ui/PromptsTable/PromptsTable';
import cls from './PromptsPage.module.scss';

export function PromptsPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="prompts-page-responsive">
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4 min-w-0" max>
        <VStack gap="4" className="min-w-0">
          <HStack gap="12" align="center">
            <FileAudio className="w-7 h-7 text-primary shrink-0" />
            <h1 className="text-2xl font-bold">{t('promptsPage.title', 'Записи')}</h1>
          </HStack>
          <p className="text-muted-foreground text-sm">
            {t('promptsPage.subtitle', 'Управление звуковыми файлами и записями')}
          </p>
        </VStack>
        <HStack gap="8" className={cls.headerActions}>
          <Button
            className={cls.actionBtn}
            onClick={() => dispatch(promptsActions.openUploadModal())}
          >
            <Upload className="w-4 h-4 mr-2" />
            {t('promptsPage.addBtn', 'Загрузить файл')}
          </Button>
          <Button
            variant="outline"
            className={cls.actionBtn}
            onClick={() => dispatch(promptsActions.openRecordModal())}
          >
            <Phone className="w-4 h-4 mr-2" />
            {t('promptsPage.recordBtn', 'Записать по телефону')}
          </Button>
          <Button
            variant="outline"
            className={cls.actionBtn}
            onClick={() => dispatch(promptsActions.openSynthesizeModal())}
          >
            <Volume2 className="w-4 h-4 mr-2" />
            {t('promptsPage.synthesizeBtn', 'Синтезировать речь')}
          </Button>
        </HStack>
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
          <PromptsTable />
        </div>
      </motion.div>
    </VStack>
  );
}
