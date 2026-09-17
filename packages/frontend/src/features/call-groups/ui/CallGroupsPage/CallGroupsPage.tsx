import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { UsersRound, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { callGroupsPageActions } from '../../model/slice/callGroupsPageSlice';
import { CallGroupsTable } from '../CallGroupsTable';
import { CallGroupFormModal } from '../CallGroupFormModal/CallGroupFormModal';
import cls from './CallGroupsPage.module.scss';

export const CallGroupsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="call-groups-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <UsersRound size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('callGroups.title', 'Группы вызовов')}
            </Text>
            <Text variant="muted">
              {t('callGroups.subtitle', 'Группы одновременного и последовательного дозвона')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(callGroupsPageActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('callGroups.create', 'Создать группу')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <CallGroupsTable />
      </Flex>

      <CallGroupFormModal />
    </VStack>
  );
});

CallGroupsPage.displayName = 'CallGroupsPage';
