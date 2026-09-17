/**
 * Page: ContextsPage - thin orchestrator
 */
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Network, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  contextsActions,
  ContextsTable,
  ContextFormModal,
} from '@/features/contexts';
import cls from './ContextsPage.module.scss';

export const ContextsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="contexts-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Network size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('contexts.title', 'Контексты')}
            </Text>
            <Text variant="muted">
              {t('contexts.subtitle', 'Контексты маршрутизации входящих и исходящих вызовов')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(contextsActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('contexts.add', 'Добавить контекст')}</Text>
        </Button>
      </Flex>

      <Flex
        direction="column"
        align="stretch"
        max
        className={cls.tableWrap}
        data-testid="hybrid-table"
        data-hybrid="overflow-x-auto"
      >
        <ContextsTable />
      </Flex>

      <ContextFormModal />
    </VStack>
  );
});

ContextsPage.displayName = 'ContextsPage';
