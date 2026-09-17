/**
 * Page: EndpointsPage - thin orchestrator
 *
 * Composes feature-level components for PJSIP subscriber management.
 * No business logic - only layout and dispatch.
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, Plus, Layers } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  endpointsPageActions,
  EndpointsTable,
  EndpointFormModal,
  BulkCreateModal,
  SipCredentialsModal,
} from '@/features/endpoints';
import cls from './EndpointsPage.module.scss';

export const EndpointsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="endpoints-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Phone size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('endpoints.title', 'Абоненты')}
            </Text>
            <Text variant="muted">
              {t('endpoints.subtitle', 'Внутренние номера и устройства')}
            </Text>
          </VStack>
        </HStack>
        <HStack gap="8" className={cls.actions}>
          <Button
            variant="outline"
            className={cls.rangeBtn}
            onClick={() => dispatch(endpointsPageActions.openBulkModal())}
          >
            <Layers size={16} className={cls.createBtnIcon} />
            <Text as="span">{t('endpoints.addRange', 'Создать диапазон')}</Text>
          </Button>
          <Button
            className={cls.createBtn}
            onClick={() => dispatch(endpointsPageActions.openCreateModal())}
          >
            <Plus size={16} className={cls.createBtnIcon} />
            <Text as="span">{t('endpoints.addEndpoint', 'Добавить абонента')}</Text>
          </Button>
        </HStack>
      </Flex>

      <Flex
        direction="column"
        align="stretch"
        max
        className={cls.tableWrap}
        data-testid="hybrid-table"
        data-hybrid="overflow-x-auto"
      >
        <EndpointsTable />
      </Flex>

      <EndpointFormModal />
      <BulkCreateModal />
      <SipCredentialsModal />
    </VStack>
  );
});

EndpointsPage.displayName = 'EndpointsPage';
