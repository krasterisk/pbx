import type { OptionsSource } from '@/features/dialplan-apps/model/schema.types';
import type { TemplateSlotKind } from '@krasterisk/shared';

export const SLOT_KIND_SOURCE: Record<TemplateSlotKind, OptionsSource> = {
  queue: 'queues',
  group: 'callGroups',
  ivr: 'ivrs',
  trunk: 'trunks',
  recording: 'prompts',
  directory: 'dialplanDirectories',
};

export const SLOT_KIND_LABEL_KEY: Record<TemplateSlotKind, string> = {
  queue: 'routes.templates.slotQueue',
  group: 'routes.templates.slotGroup',
  ivr: 'routes.templates.slotIvr',
  trunk: 'routes.templates.slotTrunk',
  recording: 'routes.templates.slotRecording',
  directory: 'routes.templates.slotDirectory',
};

export const SLOT_KIND_LABEL_FALLBACK: Record<TemplateSlotKind, string> = {
  queue: 'Какая очередь',
  group: 'Какая группа',
  ivr: 'Какой IVR',
  trunk: 'Какой транк',
  recording: 'Какая запись',
  directory: 'Какой справочник',
};
