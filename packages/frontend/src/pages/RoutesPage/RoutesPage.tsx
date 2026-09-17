/**
 * Page: RoutesPage - thin orchestrator
 *
 * Composes feature-level components for inbound/outbound routing management.
 * No business logic - only layout and dispatch.
 */
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Network, Plus } from 'lucide-react';
import { Button, Text, MultiSelect, type MultiSelectOption } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions, RoutesTable, RouteFormModal } from '@/features/routes';
import cls from './RoutesPage.module.scss';

export const RoutesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selectedContextUids = useAppSelector((s) => s.routes.selectedContextUids);

  const { data: contexts = [] } = useGetContextsQuery();

  const contextOptions: MultiSelectOption[] = useMemo(
    () => contexts.map((ctx) => ({
      value: String(ctx.uid),
      label: ctx.name + (ctx.comment ? ` (${ctx.comment})` : ''),
    })),
    [contexts],
  );

  const handleContextFilterChange = useCallback((values: string[]) => {
    const uids = values.map(Number).filter(Boolean);
    dispatch(routesActions.setContextFilter(uids));
  }, [dispatch]);

  return (
    <VStack gap="24" max className={cls.page} data-testid="routes-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Network size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('routes.title')}
            </Text>
            <Text variant="muted">
              {t('routes.subtitle')}
            </Text>
          </VStack>
        </HStack>
        <HStack gap="8" align="center" className={cls.actions}>
          <MultiSelect
            value={selectedContextUids.map(String)}
            onChange={handleContextFilterChange}
            options={contextOptions}
            placeholder={t('routes.allContexts')}
            className={cls.contextFilter}
          />
          <Button
            className={cls.createBtn}
            onClick={() => dispatch(routesActions.openCreateModal())}
          >
            <Plus size={16} className={cls.createBtnIcon} />
            <Text as="span">{t('routes.addRoute')}</Text>
          </Button>
        </HStack>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <RoutesTable />
      </Flex>

      <RouteFormModal />
    </VStack>
  );
});

RoutesPage.displayName = 'RoutesPage';
