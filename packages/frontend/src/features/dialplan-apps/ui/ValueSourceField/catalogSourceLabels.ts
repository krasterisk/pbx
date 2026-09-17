import type { OptionsSource } from '../../model/schema.types';

type TFn = (key: string, fallback?: string) => string;

export interface CatalogSourceLabels {
  dynamicGroup: string;
  staticGroup: string;
  required: string;
  placeholderSelect: string;
  orphan: (value: string) => string;
  sectionKey: string;
  sectionFallback: string;
  sectionHref: string;
}

/**
 * Copy for the catalog + dynamic-source picker (queue / conference / call group).
 * The control is the same; only section names and validation text change.
 */
export function catalogSourceLabels(
  t: TFn,
  optionsSource: OptionsSource | undefined,
  sectionName?: string,
): CatalogSourceLabels {
  if (optionsSource === 'conferenceRooms') {
    const section = sectionName ?? t('routes.chain.catalog.conferencesSection', 'Конференции');
    return {
      dynamicGroup: t('routes.chain.source.groupDynamicByNumber', 'По номеру'),
      staticGroup: section,
      required: t('routes.chain.source.requiredConference', 'Выберите комнату'),
      placeholderSelect: t('conferences.selectRoom', 'Выберите комнату'),
      orphan: (value) =>
        t('conferences.orphanRoom', '{{room}} (нет в списке)').replace('{{room}}', value),
      sectionKey: 'routes.chain.catalog.conferencesSection',
      sectionFallback: 'Конференции',
      sectionHref: '/conferences',
    };
  }
  if (optionsSource === 'callGroups') {
    const section = sectionName ?? t('routes.chain.catalog.callGroupsSection', 'Группы вызова');
    return {
      dynamicGroup: t('routes.chain.source.groupDynamicByNumber', 'По номеру'),
      staticGroup: section,
      required: t('routes.chain.source.requiredCallGroup', 'Выберите группу'),
      placeholderSelect: t('routes.apps.group.selectGroup', 'Выберите группу вызовов'),
      orphan: (value) =>
        t('routes.chain.source.groupOrphan', '{{group}} (нет в списке)').replace('{{group}}', value),
      sectionKey: 'routes.chain.catalog.callGroupsSection',
      sectionFallback: 'Группы вызова',
      sectionHref: '/call-groups',
    };
  }
  return {
    dynamicGroup: t('routes.chain.source.groupDynamic', 'Динамичная очередь'),
    staticGroup: t('routes.chain.source.groupStatic', 'Статичная очередь'),
    required: t('routes.chain.source.required', 'Укажите очередь'),
    placeholderSelect: t('routes.apps.queue.selectQueue', 'Выберите очередь'),
    orphan: (value) =>
      t('routes.chain.source.queueOrphan', '{{queue}} (нет в списке)').replace('{{queue}}', value),
    sectionKey: 'routes.chain.catalog.queuesSection',
    sectionFallback: 'Очереди',
    sectionHref: '/queues',
  };
}

export function isCatalogValueSource(
  optionsSource: OptionsSource | undefined,
): boolean {
  return (
    optionsSource === 'queues'
    || optionsSource === 'conferenceRooms'
    || optionsSource === 'callGroups'
  );
}
