import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { TimeGroupsTable, TimeGroupFormModal, timeGroupsActions } from '@/features/timeGroups';
import { getTimeGroupsModalOpen } from '@/features/timeGroups/model/selectors/timeGroupsSelectors';
import cls from './TimeGroupsPage.module.scss';

export const TimeGroupsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modalOpen = useAppSelector(getTimeGroupsModalOpen);

  return (
    <VStack gap="24" max className={cls.page} data-testid="timegroups-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Calendar size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('timeGroups.title', 'Временные группы')}
            </Text>
            <Text variant="muted">
              {t('timeGroups.subtitle', 'Расписания для условной маршрутизации по времени')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(timeGroupsActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('timeGroups.add', 'Добавить группу')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <TimeGroupsTable />
      </Flex>

      {modalOpen && <TimeGroupFormModal />}
    </VStack>
  );
});

TimeGroupsPage.displayName = 'TimeGroupsPage';
