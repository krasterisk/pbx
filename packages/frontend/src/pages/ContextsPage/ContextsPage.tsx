/**
 * Page: ContextsPage — thin orchestrator
 */
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Network, Plus } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  contextsActions,
  ContextsTable,
  ContextFormModal,
} from '@/features/contexts';

export const ContextsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <HStack gap="12" align="center">
          <Network className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">{t('contexts.title', 'Контексты')}</h1>
        </HStack>
        <HStack gap="8">
          <Button onClick={() => dispatch(contextsActions.openCreateModal())}>
            <Plus className="w-4 h-4 mr-2" />
            {t('contexts.add', 'Добавить контекст')}
          </Button>
        </HStack>
      </HStack>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <ContextsTable />
      </motion.div>

      {/* Modals */}
      <ContextFormModal />
    </VStack>
  );
};
