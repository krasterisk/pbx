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

export type CallerIdMode = 'static' | 'phonebook' | 'setclid_list' | 'carousel';

export interface INotifyActionParams {
  integration_uid?: number;
  message?: string;
  target?: string;
  preset?: string;
  channels?: NotificationChannel[];
  recipients?: Partial<Record<NotificationChannel, string>>;
  subject?: string;
  body?: string;
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
}

export interface ITrunkCarouselActionParams {
  mode: 'random_then_failover';
  trunks: ITrunkCarouselItem[];
  timeout?: number | string;
  options?: string;
  numberManipulation?: { strip?: number; prepend?: string };
}
