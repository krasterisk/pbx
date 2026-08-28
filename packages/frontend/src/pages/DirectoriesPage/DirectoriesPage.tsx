import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BookMarked, Plus } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Text } from '@/shared/ui';
import { VStack, HStack, Flex } from '@/shared/ui/Stack';
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
              {t('directories.title', 'Directories')}
            </Text>
            <Text variant="muted">
              {t('directories.subtitle', 'Schema-based lookup tables for routes and dialplan actions.')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(directoriesActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('directories.add', 'Add directory')}</Text>
        </Button>
      </Flex>

      <Card className={cls.card}>
        <CardHeader className={cls.cardHeader}>
          <CardTitle className={cls.cardTitle}>
            {t('directories.listTitle', 'Directories')}
          </CardTitle>
        </CardHeader>
        <CardContent className={cls.cardContent}>
          <Flex className={cls.tableScroll} data-testid="hybrid-table" data-hybrid="overflow-x-auto">
            <DirectoriesTable />
          </Flex>
        </CardContent>
      </Card>

      {modalOpen && <DirectoryFormModal />}
    </VStack>
  );
});

DirectoriesPage.displayName = 'DirectoriesPage';
