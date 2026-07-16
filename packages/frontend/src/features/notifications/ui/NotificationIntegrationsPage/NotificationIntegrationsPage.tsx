import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Plus, Bell } from 'lucide-react';
import { Button, Card, CardContent } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { notificationsPageActions } from '../../model/slice/notificationsPageSlice';
import { NotificationIntegrationsTable } from '../NotificationIntegrationsTable/NotificationIntegrationsTable';
import { NotificationIntegrationFormModal } from '../NotificationIntegrationFormModal/NotificationIntegrationFormModal';
import cls from './NotificationIntegrationsPage.module.scss';

export const NotificationIntegrationsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ width: '100%', minWidth: 0 }}
    >
      <VStack gap="16" max className={cls.page} data-testid="notifications-page-responsive">
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4 min-w-0" max>
          <HStack gap="8" align="center" className="min-w-0">
            <Bell className="w-6 h-6 text-primary shrink-0" />
            <h1 className="text-2xl font-bold">
              {t('notifications.title', 'Notification Integrations')}
            </h1>
          </HStack>
          <Button
            onClick={() => dispatch(notificationsPageActions.openCreateModal())}
            className={`gap-2 ${cls.createBtn}`}
          >
            <Plus className="w-4 h-4" />
            {t('notifications.create', 'Create Integration')}
          </Button>
        </HStack>

        <Card className="min-w-0">
          <CardContent className={cls.cardContent}>
            <div
              className={`${cls.tableScroll} overflow-x-auto`}
              data-testid="hybrid-table"
              data-hybrid="overflow-x-auto"
            >
              <NotificationIntegrationsTable />
            </div>
          </CardContent>
        </Card>

        <NotificationIntegrationFormModal />
      </VStack>
    </motion.div>
  );
};
