/**
 * Page: ProvisionTemplatesPage — thin orchestrator
 */
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { FileCode, Plus } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  provisionTemplatesActions,
  ProvisionTemplatesTable,
  ProvisionTemplateFormModal,
} from '@/features/provisionTemplates';

export const ProvisionTemplatesPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <HStack gap="12" align="center">
          <FileCode className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">{t('provisionTemplates.title', 'Шаблоны автонастройки')}</h1>
        </HStack>
        <HStack gap="8">
          <Button onClick={() => dispatch(provisionTemplatesActions.openCreateModal())}>
            <Plus className="w-4 h-4 mr-2" />
            {t('provisionTemplates.add', 'Добавить шаблон')}
          </Button>
        </HStack>
      </HStack>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <ProvisionTemplatesTable />
      </motion.div>

      {/* Modals */}
      <ProvisionTemplateFormModal />
    </VStack>
  );
};
