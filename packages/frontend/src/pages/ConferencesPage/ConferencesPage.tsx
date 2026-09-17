import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Video } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { conferencesPageActions } from '@/features/conferences/model/slice/conferencesPageSlice';
import { ConferencesTable } from '@/features/conferences/ui/ConferencesTable';
import { ConferenceRoomFormModal } from '@/features/conferences/ui/ConferenceRoomFormModal';
import cls from './ConferencesPage.module.scss';

export const ConferencesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="conferences-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Video size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('conferences.title')}
            </Text>
            <Text variant="muted">{t('conferences.subtitle')}</Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(conferencesPageActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('conferences.addRoom')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <ConferencesTable />
      </Flex>

      <ConferenceRoomFormModal />
    </VStack>
  );
});

ConferencesPage.displayName = 'ConferencesPage';
