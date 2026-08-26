import { useMemo } from 'react';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';
import { useGetCallGroupsQuery } from '@/shared/api/endpoints/callGroupApi';
import { useGetTrunksQuery } from '@/shared/api/endpoints/trunkApi';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';
import { useGetPhonebooksQuery } from '@/shared/api/endpoints/phonebookApi';
import { useGetIvrsQuery } from '@/shared/api/endpoints/ivrsApi';
import { useGetTtsEnginesQuery } from '@/shared/api/endpoints/ttsEnginesApi';
import { useGetVoiceRobotsQuery } from '@/shared/api/endpoints/voiceRobotsApi';
import { useGetContextsQuery } from '@/shared/api/endpoints/contextApi';
import { useGetEndpointsQuery } from '@/shared/api/endpoints/endpointApi';
import { useGetNumbersQuery } from '@/shared/api/endpoints/numberApi';
import { useGetNotificationsQuery } from '@/shared/api/endpoints/notificationApi';
import type { OptionsSource, SchemaRefs } from './schema.types';

/**
 * Single owner of every `optionsSource` catalog used by SchemaFields.
 *
 * A missing key makes `RefSelect` claim the catalog is empty, so every source
 * declared in `OptionsSource` must be resolved here even when no schema uses it
 * yet. `sources` limits the network cost to the catalogs a step actually needs.
 *
 * @layer features/dialplan-apps
 */
export function useSchemaRefs(sources?: readonly OptionsSource[]): SchemaRefs {
  const needs = (source: OptionsSource) => !sources || sources.includes(source);

  const prompts = useGetPromptsQuery(undefined, { skip: !needs('prompts') });
  const callGroups = useGetCallGroupsQuery(undefined, { skip: !needs('callGroups') });
  const trunks = useGetTrunksQuery(undefined, { skip: !needs('trunks') });
  const queues = useGetQueuesQuery(undefined, { skip: !needs('queues') });
  const phonebooks = useGetPhonebooksQuery(undefined, { skip: !needs('phonebooks') });
  const ivrs = useGetIvrsQuery(undefined, { skip: !needs('ivrs') });
  const ttsEngines = useGetTtsEnginesQuery(undefined, { skip: !needs('tts-engines') });
  const voiceRobots = useGetVoiceRobotsQuery(undefined, { skip: !needs('voiceRobots') });
  const contexts = useGetContextsQuery(undefined, { skip: !needs('contexts') });
  const endpoints = useGetEndpointsQuery(undefined, { skip: !needs('endpoints') });
  const numberLists = useGetNumbersQuery(undefined, { skip: !needs('numberLists') });
  const notifications = useGetNotificationsQuery(undefined, { skip: !needs('notifications') });

  return useMemo(
    () => ({
      prompts: {
        items: (prompts.data ?? []).map((prompt) => ({
          value: prompt.filename,
          label: prompt.comment || prompt.filename,
        })),
        isLoading: prompts.isLoading,
        sectionHref: '/prompts',
        sectionKey: 'routes.chain.catalog.promptsSection',
        sectionFallback: 'Записи',
      },
      callGroups: {
        items: (callGroups.data ?? []).map((group) => ({
          value: String(group.uid),
          label: group.exten ? `${group.exten} - ${group.name}` : group.name,
        })),
        isLoading: callGroups.isLoading,
        sectionHref: '/call-groups',
        sectionKey: 'routes.chain.catalog.callGroupsSection',
        sectionFallback: 'Группы вызова',
      },
      trunks: {
        items: (trunks.data ?? []).map((trunk) => ({
          value: trunk.name,
          label: trunk.name,
        })),
        isLoading: trunks.isLoading,
        sectionHref: '/trunks',
        sectionKey: 'routes.chain.catalog.trunksSection',
        sectionFallback: 'Транки',
      },
      queues: {
        items: (queues.data ?? []).map((queue) => ({
          value: queue.exten || queue.name,
          label: queue.display_name ? `${queue.exten || queue.name} - ${queue.display_name}` : queue.exten || queue.name,
        })),
        isLoading: queues.isLoading,
        sectionHref: '/queues',
        sectionKey: 'routes.chain.catalog.queuesSection',
        sectionFallback: 'Очереди',
      },
      phonebooks: {
        items: (phonebooks.data ?? []).map((phonebook) => ({
          value: String(phonebook.uid),
          label: phonebook.name,
        })),
        isLoading: phonebooks.isLoading,
        sectionHref: '/phonebooks',
        sectionKey: 'routes.chain.catalog.phonebooksSection',
        sectionFallback: 'Справочники',
      },
      ivrs: {
        items: (ivrs.data ?? []).map((ivr) => ({
          value: String(ivr.uid),
          label: ivr.name,
        })),
        isLoading: ivrs.isLoading,
        sectionHref: '/ivrs',
        sectionKey: 'routes.chain.catalog.ivrsSection',
        sectionFallback: 'IVR',
      },
      'tts-engines': {
        items: (ttsEngines.data ?? []).map((engine) => ({
          value: String(engine.uid),
          label: engine.name,
        })),
        isLoading: ttsEngines.isLoading,
        sectionHref: '/settings/tts-engines',
        sectionKey: 'routes.chain.catalog.ttsSection',
        sectionFallback: 'Движки синтеза',
      },
      voiceRobots: {
        items: (voiceRobots.data ?? []).map((robot) => ({
          value: String(robot.uid),
          label: robot.name,
        })),
        isLoading: voiceRobots.isLoading,
        sectionHref: '/voice-robots',
        sectionKey: 'routes.chain.catalog.voiceRobotsSection',
        sectionFallback: 'Голосовые роботы',
      },
      contexts: {
        items: (contexts.data ?? []).map((context) => ({
          value: context.name,
          label: context.comment ? `${context.name} - ${context.comment}` : context.name,
        })),
        isLoading: contexts.isLoading,
        sectionHref: '/contexts',
        sectionKey: 'routes.chain.catalog.contextsSection',
        sectionFallback: 'Контексты',
      },
      endpoints: {
        items: (endpoints.data ?? []).map((endpoint) => ({
          value: endpoint.extension,
          label: endpoint.callerid ? `${endpoint.extension} - ${endpoint.callerid}` : endpoint.extension,
        })),
        isLoading: endpoints.isLoading,
        sectionHref: '/endpoints',
        sectionKey: 'routes.chain.catalog.endpointsSection',
        sectionFallback: 'Абоненты',
      },
      numberLists: {
        items: (numberLists.data ?? []).map((list) => ({
          value: String(list.id),
          label: list.comment ? `${list.name} - ${list.comment}` : list.name,
        })),
        isLoading: numberLists.isLoading,
        sectionHref: '/numbers',
        sectionKey: 'routes.chain.catalog.numberListsSection',
        sectionFallback: 'Списки доступа',
      },
      notifications: {
        items: (notifications.data ?? []).map((integration) => ({
          value: String(integration.uid),
          label: `${integration.name} (${integration.channel})`,
        })),
        isLoading: notifications.isLoading,
        sectionHref: '/notifications',
        sectionKey: 'routes.chain.catalog.notificationsSection',
        sectionFallback: 'Интеграции уведомлений',
      },
    }),
    [
      prompts.data,
      prompts.isLoading,
      callGroups.data,
      callGroups.isLoading,
      trunks.data,
      trunks.isLoading,
      queues.data,
      queues.isLoading,
      phonebooks.data,
      phonebooks.isLoading,
      ivrs.data,
      ivrs.isLoading,
      ttsEngines.data,
      ttsEngines.isLoading,
      voiceRobots.data,
      voiceRobots.isLoading,
      contexts.data,
      contexts.isLoading,
      endpoints.data,
      endpoints.isLoading,
      numberLists.data,
      numberLists.isLoading,
      notifications.data,
      notifications.isLoading,
    ],
  );
}
