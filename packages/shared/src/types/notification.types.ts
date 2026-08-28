import type { CallValueSource } from './directory.types';

export type NotificationChannel =
  | 'telegram'
  | 'email'
  | 'whatsapp'
  | 'webhook'
  | 'max'
  | 'vk';

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

