import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Plus, Bell } from 'lucide-react';
import { Button, Card, CardContent } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { notificationsPageActions } from '../../model/slice/notificationsPageSlice';
import { NotificationIntegrationsTable } from '../NotificationIntegrationsTable/NotificationIntegrationsTable';
import { NotificationIntegrationFormModal } from '../NotificationIntegrationFormModal/NotificationIntegrationFormModal';

export const NotificationIntegrationsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <VStack gap="16" max>
        <HStack justify="between" align="center" max>
          <HStack gap="8" align="center">
            <Bell className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">
              {t('notifications.title', 'Notification Integrations')}
            </h1>
          </HStack>
          <Button
            onClick={() => dispatch(notificationsPageActions.openCreateModal())}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('notifications.create', 'Create Integration')}
          </Button>
        </HStack>

        <Card>
          <CardContent className="p-0">
            <NotificationIntegrationsTable />
          </CardContent>
        </Card>

        <NotificationIntegrationFormModal />
      </VStack>
    </motion.div>
  );
};
