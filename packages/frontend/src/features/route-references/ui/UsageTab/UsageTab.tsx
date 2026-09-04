import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import type { IRoute } from '@krasterisk/shared';
import { Badge, Card, InfoTooltip, SkeletonText, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import {
  isRouteReferenceApiKind,
  useGetUsageQuery,
  type RouteReferenceKind,
} from '@/shared/api/endpoints/routeReferencesApi';
import { useGetAllRoutesQuery } from '@/shared/api/endpoints/routeApi';
import { describeUsageReference } from '../../model/describeUsageReference';
import cls from './UsageTab.module.scss';

export { formatReferenceLocation } from '../../model/describeUsageReference';

export interface UsageTabProps {
  kind: RouteReferenceKind;
  uid: number | string | undefined;
  /** D-48: route host always admits address-pattern refs the index cannot list. */
  showTorouteCaveat?: boolean;
}

export function UsageTab({ kind, uid, showTorouteCaveat = kind === 'route' }: UsageTabProps) {
  const { t } = useTranslation();
  const skip = uid == null || uid === '' || !isRouteReferenceApiKind(kind);
  const { data, isLoading, isError } = useGetUsageQuery(
    { kind, uid: uid ?? '' },
    { skip },
  );
  const { data: routes = [] } = useGetAllRoutesQuery(undefined, { skip });

  const routesByUid = useMemo(() => {
    const map = new Map<number, IRoute>();
    for (const route of routes) map.set(route.uid, route);
    return map;
  }, [routes]);

  const references = data?.references ?? [];
  const hasIvrHits = references.some((ref) => ref.host === 'ivr' || /^IVR\s/i.test(ref.location));
  const hasRouteHits = references.some((ref) => ref.host !== 'ivr' && !/^IVR\s/i.test(ref.location));
  const hasRawDialplanRoutes = Boolean(data?.meta?.hasRawDialplanRoutes ?? data?.hasRawDialplanRoutes);
  const loading = !skip && isLoading;
  const empty = !loading && !isError && references.length === 0;
  const listHeading = hasIvrHits && hasRouteHits
    ? t('references.listHeadingMixed', 'Ссылаются маршруты и меню IVR')
    : hasIvrHits
      ? t('references.listHeadingIvr', 'Ссылаются меню IVR')
      : t('references.listHeading', 'Ссылаются маршруты');
  const listCount = hasIvrHits && hasRouteHits
    ? t('references.countMixed', 'Ссылок: {{count}}', { count: references.length })
    : hasIvrHits
      ? t('references.countIvr', 'Меню: {{count}}', { count: references.length })
      : t('references.count', 'Маршрутов: {{count}}', { count: references.length });

  return (
    <VStack gap="16" max className={cls.root} data-testid="usage-tab">
      {loading && (
        <VStack gap="8" max>
          <Text variant="muted">{t('references.loading', 'Ищем ссылки')}</Text>
          <SkeletonText lines={3} />
        </VStack>
      )}

      {isError && !skip && (
        <VStack gap="8" max data-testid="usage-tab-error">
          <HStack gap="4" align="center">
            <Text variant="error">{t('references.error', 'Не удалось проверить ссылки')}</Text>
            <InfoTooltip
              text={t(
                'references.errorHint',
                'Пока проверка не прошла, удаление недоступно',
              )}
            />
          </HStack>
        </VStack>
      )}

      {empty && (
        <VStack gap="8" align="center" max className={cls.empty} data-testid="usage-tab-empty">
          <Text as="h3" className={cls.heading}>
            {t('references.emptyHeading', 'Нигде не используется')}
          </Text>
          <Text className={cls.body}>
            {t(
              'references.emptyBody',
              'Эту сущность не вызывает ни один маршрут, её можно удалить без последствий',
            )}
          </Text>
        </VStack>
      )}

      {!loading && !isError && references.length > 0 && (
        <VStack gap="12" max data-testid="usage-tab-list">
          <HStack gap="8" align="center" justify="between" max>
            <Text as="h3" className={cls.heading}>
              {listHeading}
            </Text>
            <Text variant="muted">{listCount}</Text>
          </HStack>
          <VStack gap="8" max>
            {references.map((ref) => {
              const route = routesByUid.get(ref.routeUid);
              const view = describeUsageReference(ref, route, t);
              return (
                <Card
                  key={`${ref.host ?? 'route'}:${ref.routeUid}:${ref.ivrUid ?? ''}:${ref.actionOrBindingId}:${ref.location}`}
                  className={cls.row}
                  data-testid="usage-tab-row"
                >
                  <HStack gap="8" align="center" justify="between" max>
                    <VStack gap="4">
                      <Text className={cls.routeName}>{view.title}</Text>
                      {view.subtitle ? (
                        <Text variant="muted" className={cls.subtitle}>{view.subtitle}</Text>
                      ) : null}
                      <Badge variant="outline" className={cls.location}>
                        {view.location}
                      </Badge>
                    </VStack>
                    <HStack gap="8" align="center">
                      {view.disabled && (
                        <Badge variant="secondary">{t('references.disabled', 'Выключен')}</Badge>
                      )}
                      <a
                        className={cls.link}
                        href={view.href}
                        target="_blank"
                        rel="noreferrer"
                        title={t(
                          'references.openHint',
                          'Черновик текущей формы не потеряется',
                        )}
                        aria-label={t('references.open', 'Открыть в новой вкладке')}
                      >
                        {t('references.open', 'Открыть в новой вкладке')}
                        <ExternalLink size={14} aria-hidden />
                      </a>
                    </HStack>
                  </HStack>
                </Card>
              );
            })}
          </VStack>
        </VStack>
      )}

      {!loading && (hasRawDialplanRoutes || showTorouteCaveat) && (
        <VStack gap="8" className={cls.caveats} data-testid="usage-tab-caveats">
          {hasRawDialplanRoutes && (
            <HStack gap="4" align="center" data-testid="usage-tab-raw-dialplan-caveat">
              <InfoTooltip
                text={t(
                  'references.rawDialplanCaveat',
                  'В тенанте есть маршруты с рукописным диалпланом, их содержимое здесь не учтено',
                )}
              />
              <Text variant="muted">
                {t(
                  'references.rawDialplanCaveat',
                  'В тенанте есть маршруты с рукописным диалпланом, их содержимое здесь не учтено',
                )}
              </Text>
            </HStack>
          )}
          {showTorouteCaveat && (
            <HStack gap="4" align="center" data-testid="usage-tab-toroute-caveat">
              <InfoTooltip
                text={t(
                  'references.torouteCaveat',
                  'На маршрут могут ссылаться по шаблону номера, такие ссылки список не покажет',
                )}
              />
              <Text variant="muted">
                {t(
                  'references.torouteCaveat',
                  'На маршрут могут ссылаться по шаблону номера, такие ссылки список не покажет',
                )}
              </Text>
            </HStack>
          )}
        </VStack>
      )}
    </VStack>
  );
}
