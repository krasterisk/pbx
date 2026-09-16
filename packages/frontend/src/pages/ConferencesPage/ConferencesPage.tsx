import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Video } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { conferencesPageActions } from '@/features/conferences/model/slice/conferencesPageSlice';
import { ConferencesTable } from '@/features/conferences/ui/ConferencesTable';
import { ConferenceRoomFormModal } from '@/features/conferences/ui/ConferenceRoomFormModal';
import cls from '@/features/conferences/ui/ConferencesTable/ConferencesTable.module.scss';

export const ConferencesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max data-testid="conferences-page">
      <Flex justify="between" align="center" max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Video size={24} />
          </Flex>
          <VStack gap="4">
            <Text variant="h1" as="h1" className={cls.title}>
              {t('conferences.title', 'Конференции')}
            </Text>
            <Text variant="muted">
              {t('conferences.subtitle', 'Комнаты телеконференций, роли участников и записи встреч')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(conferencesPageActions.openCreateModal())}
        >
          <Plus size={16} />
          <Text as="span">{t('conferences.addRoom', 'Создать комнату')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max>
        <ConferencesTable />
      </Flex>

      <ConferenceRoomFormModal />
    </VStack>
  );
});

ConferencesPage.displayName = 'ConferencesPage';
