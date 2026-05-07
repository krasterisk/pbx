/**
 * Page: RoutesPage - thin orchestrator
 *
 * Composes feature-level components for inbound/outbound routing management.
 * No business logic - only layout and dispatch.
 */
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Plus, Network } from 'lucide-react';
import { Button, Text, MultiSelect, type MultiSelectOption } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '@/features/routes';
import { RoutesTable } from '@/features/routes/ui/RoutesTable/RoutesTable';
import { RouteFormModal } from '@/features/routes/ui/RouteFormModal/RouteFormModal';

export const RoutesPage = () => {
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

  const handleContextFilterChange = useCallback((csv: string) => {
    const uids = csv ? csv.split(',').map(Number).filter(Boolean) : [];
    dispatch(routesActions.setContextFilter(uids));
  }, [dispatch]);

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <HStack gap="12" align="center">
          <Network className="w-7 h-7 text-primary" />
          <Text as="h1" className="text-2xl font-bold">{t('routes.title', 'Маршрутизация')}</Text>
        </HStack>
        <HStack gap="8" align="center">
          <MultiSelect
            value={selectedContextUids.map(String)}
            onChange={handleContextFilterChange}
            options={contextOptions}
            placeholder={t('routes.allContexts', 'Все контексты')}
            className="min-w-[220px]"
          />
          <Button onClick={() => dispatch(routesActions.openCreateModal())}>
            <Plus className="w-4 h-4 mr-2" />
            {t('routes.addRoute', 'Новый маршрут')}
          </Button>
        </HStack>
      </HStack>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <RoutesTable />
      </motion.div>

      {/* Modals - reads state from Redux */}
      <RouteFormModal />
    </VStack>
  );
};
