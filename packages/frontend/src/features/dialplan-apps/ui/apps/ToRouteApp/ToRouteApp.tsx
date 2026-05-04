import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { IDialplanAppProps } from '../../../model/types';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useGetRoutesByContextQuery } from '@/shared/api/endpoints/routeApi';

/**
 * ToRouteApp — select a target context and route (rule) to redirect to.
 *
 * Saves params:
 *   - context: string  — context name (used in dialplan Goto)
 *   - extension: string — first extension pattern of the selected route
 */
export const ToRouteApp: React.FC<IDialplanAppProps> = ({ action, onUpdate }) => {
  const { t } = useTranslation();
  const { data: contexts = [], isLoading: ctxLoading } = useGetContextsQuery();

  // Find the uid of the currently selected context by name
  const selectedContextUid = useMemo(() => {
    if (!action.params?.context) return undefined;
    const found = contexts.find(c => c.name === action.params.context);
    return found?.uid;
  }, [action.params?.context, contexts]);

  // Fetch routes for the selected context
  const { data: routes = [], isLoading: routesLoading } = useGetRoutesByContextQuery(
    selectedContextUid!,
    { skip: !selectedContextUid },
  );

  const handleContextChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ctx = contexts.find(c => c.uid === Number(e.target.value));
    if (ctx) {
      onUpdate(action.id, 'params.context', ctx.name);
      // Reset extension when context changes
      onUpdate(action.id, 'params.extension', '');
    }
  };

  const handleRouteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate(action.id, 'params.extension', e.target.value);
  };

  /**
   * Format route extensions for display.
   * If a route has many extensions, show first 3 + count of remaining.
   */
  const formatExtensions = (extensions?: string[]): string => {
    if (!extensions || extensions.length === 0) return '';
    if (extensions.length <= 3) return extensions.join(', ');
    return `${extensions.slice(0, 3).join(', ')} +${extensions.length - 3}`;
  };

  return (
    <HStack gap="8" className="w-full">
      {/* Context selector */}
      <VStack gap="2" className="flex-1">
        <Select
          value={selectedContextUid || ''}
          onChange={handleContextChange}
          disabled={ctxLoading}
        >
          <option value="" disabled>
            {t('routes.apps.route.context', 'Контекст')}
          </option>
          {contexts.map(ctx => (
            <option key={ctx.uid} value={ctx.uid}>
              {ctx.name}{ctx.comment ? ` (${ctx.comment})` : ''}
            </option>
          ))}
        </Select>
      </VStack>

      {/* Route (rule) selector — shows after context is chosen */}
      <VStack gap="2" className="flex-1">
        {selectedContextUid ? (
          <Select
            value={action.params?.extension || ''}
            onChange={handleRouteChange}
            disabled={routesLoading}
          >
            <option value="" disabled>
              {routesLoading
                ? t('common.loading', 'Загрузка...')
                : t('routes.apps.route.selectRule', 'Правило')}
            </option>
            {routes.map(route => (
              <option key={route.uid} value={route.extensions?.[0] || route.name}>
                {route.name}
                {route.extensions?.length ? ` [${formatExtensions(route.extensions)}]` : ''}
              </option>
            ))}
          </Select>
        ) : (
          <Select disabled>
            <option>{t('routes.apps.route.selectContextFirst', 'Сначала выберите контекст')}</option>
          </Select>
        )}
      </VStack>
    </HStack>
  );
};
