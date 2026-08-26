/**
 * Page: ContextsPage - thin orchestrator
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
import cls from './ContextsPage.module.scss';

export const ContextsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="contexts-page-responsive">
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4 min-w-0" max>
        <HStack gap="12" align="center" className="min-w-0">
          <Network className="w-7 h-7 text-primary shrink-0" />
          <h1 className="text-2xl font-bold">{t('contexts.title', 'Контексты')}</h1>
        </HStack>
        <HStack gap="8" className="w-full sm:w-auto">
          <Button
            className={cls.createBtn}
            onClick={() => dispatch(contextsActions.openCreateModal())}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('contexts.add', 'Добавить контекст')}
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
          <ContextsTable />
        </div>
      </motion.div>

      {/* Modals */}
      <ContextFormModal />
    </VStack>
  );
};
