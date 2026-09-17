import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { List, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { NumbersTable, NumberFormModal, numbersPageActions } from '@/features/numbers';
import cls from './NumbersPage.module.scss';

export const NumbersPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="numbers-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <List size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('numbers.title', 'Списки доступа')}
            </Text>
            <Text variant="muted">
              {t('numbers.subtitle', 'Списки видимости очередей, операторов, маршрутов и CDR.')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(numbersPageActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('numbers.add')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <NumbersTable />
      </Flex>

      <NumberFormModal />
    </VStack>
  );
});

NumbersPage.displayName = 'NumbersPage';
