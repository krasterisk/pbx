import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { notificationsPageActions } from '../../model/slice/notificationsPageSlice';
import { NotificationIntegrationsTable } from '../NotificationIntegrationsTable';
import { NotificationIntegrationFormModal } from '../NotificationIntegrationFormModal/NotificationIntegrationFormModal';
import cls from './NotificationIntegrationsPage.module.scss';

export const NotificationIntegrationsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="notifications-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Bell size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('notifications.title', 'Интеграции уведомлений')}
            </Text>
            <Text variant="muted">
              {t('notifications.subtitle', 'Каналы доставки уведомлений из маршрутов')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(notificationsPageActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('notifications.create', 'Создать интеграцию')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <NotificationIntegrationsTable />
      </Flex>

      <NotificationIntegrationFormModal />
    </VStack>
  );
});

NotificationIntegrationsPage.displayName = 'NotificationIntegrationsPage';
