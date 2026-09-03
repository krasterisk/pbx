import type { IRouteAction, ITemplateSlot } from '@krasterisk/shared';
import { templateSlotMarker } from '@krasterisk/shared';

export interface BuiltinRouteTemplateSeed {
  key: 'queue_failover' | 'ivr_handoff' | 'business_hours';
  name: string;
  description: string;
  actions: IRouteAction[];
  slots: ITemplateSlot[];
}

const QUEUE_SLOT = 'queue';
const GREETING_SLOT = 'greeting';
const IVR_SLOT = 'ivr';
const AFTER_HOURS_SLOT = 'after_hours_prompt';

export const BUILTIN_ROUTE_TEMPLATES: BuiltinRouteTemplateSeed[] = [
  {
    key: 'queue_failover',
    name: 'Queue + failover',
    description: 'Send the caller to a queue; on failure notify and hang up.',
    slots: [{ id: QUEUE_SLOT, kind: 'queue', label: 'Queue' }],
    actions: [
      {
        id: 'builtin-queue-failover-toqueue',
        type: 'toqueue',
        params: { target: { source: 'fixed', value: templateSlotMarker(QUEUE_SLOT) } },
        condition: {},
      },
      {
        id: 'builtin-queue-failover-notify',
        type: 'notify',
        params: { body: 'Queue call failed' },
        condition: { dialstatus: ['NOANSWER', 'BUSY', 'CHANUNAVAIL', 'CONGESTION'] },
      },
      {
        id: 'builtin-queue-failover-hangup',
        type: 'hangup',
        params: { signal: 'hangup' },
        condition: { dialstatus: ['NOANSWER', 'BUSY', 'CHANUNAVAIL', 'CONGESTION'] },
      },
    ],
  },
  {
    key: 'ivr_handoff',
    name: 'IVR handoff',
    description: 'Play a greeting, then hand the caller to an IVR menu.',
    slots: [
      { id: GREETING_SLOT, kind: 'recording', label: 'Greeting' },
      { id: IVR_SLOT, kind: 'ivr', label: 'IVR menu' },
    ],
    actions: [
      {
        id: 'builtin-ivr-handoff-playback',
        type: 'playback',
        params: { files: templateSlotMarker(GREETING_SLOT), mode: 'plain' },
        condition: {},
      },
      {
        id: 'builtin-ivr-handoff-toivr',
        type: 'toivr',
        params: { ivr_uid: templateSlotMarker(IVR_SLOT) },
        condition: {},
      },
    ],
  },
  {
    key: 'business_hours',
    name: 'Business hours',
    description: 'In-hours continue; after hours play a message and hang up.',
    slots: [{ id: AFTER_HOURS_SLOT, kind: 'recording', label: 'After-hours message' }],
    actions: [
      {
        id: 'builtin-hours-schedule',
        type: 'schedule',
        params: {
          intervals: [
            {
              time_start: '09:00',
              time_end: '18:00',
              days_of_week: 'mon-fri',
              days_of_month: '*',
              months: '*',
            },
          ],
        },
        condition: {},
      },
      {
        id: 'builtin-hours-playback',
        type: 'playback',
        params: { files: templateSlotMarker(AFTER_HOURS_SLOT), mode: 'plain' },
        condition: {},
      },
      {
        id: 'builtin-hours-hangup',
        type: 'hangup',
        params: { signal: 'hangup' },
        condition: {},
      },
    ],
  },
];
