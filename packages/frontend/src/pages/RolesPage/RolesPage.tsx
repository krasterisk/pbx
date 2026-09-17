import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { RolesTable, RoleFormModal, rolesPageActions } from '@/features/roles';
import cls from './RolesPage.module.scss';

export const RolesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="roles-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Shield size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('roles.title', 'Профили доступа')}
            </Text>
            <Text variant="muted">
              {t('roles.subtitle', 'Профили доступа определяют, какие модули системы пользователь видит в интерфейсе.')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(rolesPageActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('roles.add')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <RolesTable />
      </Flex>

      <RoleFormModal />
    </VStack>
  );
});

RolesPage.displayName = 'RolesPage';
