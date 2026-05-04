/**
 * Page: RoutesPage — thin orchestrator
 *
 * Composes feature-level components for inbound/outbound routing management.
 * No business logic — only layout and dispatch.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Plus, Network } from 'lucide-react';
import { Button, Card, CardContent } from '@/shared/ui';
import { Select } from '@/shared/ui/Select/Select';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetContextsQuery } from '@/shared/api/api';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import { routesActions } from '@/features/routes';
import { RoutesTable } from '@/features/routes/ui/RoutesTable/RoutesTable';
import { RouteFormModal } from '@/features/routes/ui/RouteFormModal/RouteFormModal';

export const RoutesPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const selectedContextUid = useAppSelector((s) => s.routes.selectedContextUid);

  const { data: contexts = [] } = useGetContextsQuery();

  const handleContextChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const uid = Number(e.target.value);
    dispatch(routesActions.selectContext(uid));
  }, [dispatch]);

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <HStack gap="12" align="center">
          <Network className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">{t('routes.title', 'Маршрутизация')}</h1>
        </HStack>
        <HStack gap="8" align="center">
          <Select
            value={selectedContextUid || ''}
            onChange={handleContextChange}
          >
            <option value="" disabled>{t('routes.selectContext', '— Выберите контекст —')}</option>
            {contexts.map((ctx) => (
              <option key={ctx.uid} value={ctx.uid}>
                {ctx.name} {ctx.comment ? `(${ctx.comment})` : ''}
              </option>
            ))}
          </Select>
          {selectedContextUid && (
            <Button onClick={() => dispatch(routesActions.openCreateModal())}>
              <Plus className="w-4 h-4 mr-2" />
              {t('routes.addRoute', 'Новый маршрут')}
            </Button>
          )}
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

      {/* Modals — reads state from Redux */}
      <RouteFormModal />
    </VStack>
  );
};
