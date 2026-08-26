import type { DialTargetRewrite, ValueSource } from './dialplan-params.types';

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

export type CallerIdMode = 'static' | 'phonebook' | 'number_list' | 'carousel';

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
  phonebook_uid?: number;
  list_uid?: number;
  /** CID pool for carousel mode */
  pool?: string[];
}

export interface ITrunkCarouselItem {
  trunk: string;
  cid_mode: 'static' | 'phonebook';
  callerid?: string;
  phonebook_uid?: number;
  /** Per-trunk Dial timeout; falls back to action-level timeout (D-36). */
  timeout?: number | string;
}

