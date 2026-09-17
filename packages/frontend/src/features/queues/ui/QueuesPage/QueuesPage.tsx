import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ListOrdered, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { queuesPageActions } from '../../model/slice/queuesPageSlice';
import { QueuesTable } from '../QueuesTable';
import { QueueFormModal } from '../QueueFormModal/QueueFormModal';
import cls from './QueuesPage.module.scss';

export const QueuesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="queues-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <ListOrdered size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('queues.title', 'Очереди')}
            </Text>
            <Text variant="muted">
              {t('queues.subtitle', 'Очереди вызовов и стратегии распределения')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(queuesPageActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('queues.addQueue', 'Создать очередь')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <QueuesTable />
      </Flex>

      <QueueFormModal />
    </VStack>
  );
});

QueuesPage.displayName = 'QueuesPage';
