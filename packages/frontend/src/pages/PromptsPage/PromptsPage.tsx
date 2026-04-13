import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Volume2, Upload, Phone, FileAudio } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { promptsActions } from '@/features/prompts/model/slice/promptsSlice';
import { PromptsTable } from '@/features/prompts/ui/PromptsTable/PromptsTable';

export function PromptsPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <FileAudio className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">{t('promptsPage.title', 'Записи')}</h1>
          </HStack>
          <p className="text-muted-foreground text-sm">
            {t('promptsPage.subtitle', 'Управление звуковыми файлами и записями')}
          </p>
        </VStack>
        <HStack gap="8" className="flex-wrap justify-end">
          <Button onClick={() => dispatch(promptsActions.openUploadModal())}>
            <Upload className="w-4 h-4 mr-2" />
            {t('promptsPage.addBtn', 'Загрузить файл')}
          </Button>
          <Button variant="outline" onClick={() => dispatch(promptsActions.openRecordModal())}>
            <Phone className="w-4 h-4 mr-2" />
            {t('promptsPage.recordBtn', 'Записать по телефону')}
          </Button>
          <Button variant="outline" disabled>
             <Volume2 className="w-4 h-4 mr-2" />
             {t('promptsPage.synthesizeBtn', 'Синтезировать речь')}
           </Button>
        </HStack>
      </HStack>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <PromptsTable />
      </motion.div>
    </VStack>
  );
}
