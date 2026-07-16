import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Plus, ListOrdered } from 'lucide-react';
import { Button, Card, CardHeader, CardContent } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { queuesPageActions } from '../../model/slice/queuesPageSlice';
import { QueuesTable } from '../QueuesTable/QueuesTable';
import { QueueFormModal } from '../QueueFormModal/QueueFormModal';

export const QueuesPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <VStack gap="16" max className="min-w-0 max-w-full">
        {/* Toolbar */}
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4 min-w-0" max>
          <HStack gap="8" align="center">
            <ListOrdered className="w-6 h-6 text-primary shrink-0" />
            <h1 className="text-2xl font-bold">{t('queues.title', 'Очереди')}</h1>
          </HStack>
          <Button
            onClick={() => dispatch(queuesPageActions.openCreateModal())}
            className="gap-2 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            {t('queues.addQueue', 'Создать очередь')}
          </Button>
        </HStack>

        {/* Table */}
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-0">
            <QueuesTable />
          </CardContent>
        </Card>

        {/* Modal */}
        <QueueFormModal />
      </VStack>
    </motion.div>
  );
};
