import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookMarked, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { DirectoriesTable, DirectoryFormModal, directoriesActions } from '@/features/directories';
import { getDirectoriesModalOpen } from '@/features/directories/model/selectors/directoriesSelectors';
import cls from './DirectoriesPage.module.scss';

export const DirectoriesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modalOpen = useAppSelector(getDirectoriesModalOpen);

  return (
    <VStack gap="24" max className={cls.page} data-testid="directories-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <BookMarked size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('directories.title')}
            </Text>
            <Text variant="muted">{t('directories.subtitle')}</Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(directoriesActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('directories.add')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <DirectoriesTable />
      </Flex>

      {modalOpen && <DirectoryFormModal />}
    </VStack>
  );
});

DirectoriesPage.displayName = 'DirectoriesPage';
