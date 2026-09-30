import type { CallValueSource } from './directory.types';

export type NotificationChannel =
  | 'telegram'
  | 'email'
  | 'whatsapp'
  | 'webhook'
  | 'max'
  | 'vk';

/** Config key that holds every destination. The singular key stays the first item for older readers. */
export const NOTIFICATION_DESTINATION_LIST_KEYS: Record<string, string> = {
  chat_id: 'chat_ids',
  to: 'recipients',
  url: 'urls',
  user_id: 'user_ids',
  peer_id: 'peer_ids',
};

export function readNotificationDestinations(
  config: Record<string, unknown> | null | undefined,
  key: string,
): string[] {
  const listKey = NOTIFICATION_DESTINATION_LIST_KEYS[key];
  const listed = listKey ? config?.[listKey] : undefined;
  if (Array.isArray(listed)) {
    const items = listed.map((value) => String(value).trim()).filter(Boolean);
    if (items.length) return items;
  }
  const single = config?.[key];
  if (typeof single === 'number' && Number.isFinite(single)) return [String(single)];
  if (typeof single === 'string' && single.trim()) return [single.trim()];
  return [];
}

export function packNotificationDestinations(key: string, values: string[]): Record<string, unknown> {
  const items = values.map((value) => value.trim()).filter(Boolean);
  if (!items.length) return {};
  const listKey = NOTIFICATION_DESTINATION_LIST_KEYS[key];
  return {
    [key]: items[0],
    ...(listKey ? { [listKey]: items } : {}),
  };
}

/** Client-facing integration record — secrets are stored server-side only. */
export interface INotificationIntegration {
  uid: number;
  name: string;
  channel: NotificationChannel;
  /** Non-secret channel config (chat_id, webhook URL template, etc.) */
  config: Record<string, any>;
  user_uid: number;
}

export type CallerIdMode = 'static' | 'directory' | 'number_list' | 'carousel';

/**
 * The channel is owned by the integration, not by the step: the dispatcher
 * loads one integration and sends through it. `target` only overrides the
 * recipient configured on that integration.
 */
export interface INotifyActionParams {
  integration_uid?: number;
  body?: string;
  target?: string;
  subject?: string;
}

export interface ICallerIdActionParams {
  mode: CallerIdMode;
  callerid?: string;
  name?: string;
  directoryUid?: number;
  valueFieldUid?: number;
  keySource?: CallValueSource;
  onMissing?: 'keep' | 'empty' | 'skip';
  list_uid?: number;
  /** CID pool for carousel mode */
  pool?: string[];
}

