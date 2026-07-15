import type { NotificationChannel } from '@krasterisk/shared';

export interface ChannelFieldDescriptor {
  key: string;
  labelKey: string;
  hintKey: string;
  secret: boolean;
}

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  'telegram',
  'email',
  'whatsapp',
  'webhook',
  'max',
  'vk',
];

export const CHANNEL_FIELDS: Record<NotificationChannel, ChannelFieldDescriptor[]> = {
  telegram: [
    {
      key: 'bot_token',
      labelKey: 'notifications.fields.bot_token',
      hintKey: 'notifications.hints.bot_token',
      secret: true,
    },
    {
      key: 'chat_id',
      labelKey: 'notifications.fields.chat_id',
      hintKey: 'notifications.hints.chat_id',
      secret: false,
    },
  ],
  email: [
    {
      key: 'to',
      labelKey: 'notifications.fields.to',
      hintKey: 'notifications.hints.to',
      secret: false,
    },
  ],
  whatsapp: [
    {
      key: 'phone_number_id',
      labelKey: 'notifications.fields.phone_number_id',
      hintKey: 'notifications.hints.phone_number_id',
      secret: false,
    },
    {
      key: 'access_token',
      labelKey: 'notifications.fields.access_token',
      hintKey: 'notifications.hints.whatsapp_access_token',
      secret: true,
    },
  ],
  webhook: [
    {
      key: 'url',
      labelKey: 'notifications.fields.url',
      hintKey: 'notifications.hints.url',
      secret: false,
    },
    {
      key: 'payload_template',
      labelKey: 'notifications.fields.payload_template',
      hintKey: 'notifications.hints.payload_template',
      secret: false,
    },
  ],
  max: [
    {
      key: 'access_token',
      labelKey: 'notifications.fields.access_token',
      hintKey: 'notifications.hints.max_access_token',
      secret: true,
    },
    {
      key: 'user_id',
      labelKey: 'notifications.fields.user_id',
      hintKey: 'notifications.hints.user_id',
      secret: false,
    },
  ],
  vk: [
    {
      key: 'access_token',
      labelKey: 'notifications.fields.access_token',
      hintKey: 'notifications.hints.vk_access_token',
      secret: true,
    },
    {
      key: 'peer_id',
      labelKey: 'notifications.fields.peer_id',
      hintKey: 'notifications.hints.peer_id',
      secret: false,
    },
  ],
};
