import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { usersPageActions, UsersTable, UserFormModal } from '@/features/users';
import cls from './UsersPage.module.scss';

export const UsersPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="users-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Users size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('users.title', 'Пользователи')}
            </Text>
            <Text variant="muted">
              {t('users.subtitle', 'Пользователи модуля Система: роли, профили и списки доступа.')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(usersPageActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('users.add')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <UsersTable />
      </Flex>

      <UserFormModal />
    </VStack>
  );
});

UsersPage.displayName = 'UsersPage';
