import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/shared/ui';
import type { NotificationChannel } from '@krasterisk/shared';
import type { FieldSchema } from '../../../model/schema.types';
import type { IDialplanAppProps } from '../../../model/types';
import { SchemaFields } from '../../SchemaFields/SchemaFields';
import cls from './NotifyApp.module.scss';

const CHANNELS: NotificationChannel[] = [
  'email',
  'telegram',
  'whatsapp',
  'webhook',
  'max',
  'vk',
];

const RECIPIENT_CHANNELS: NotificationChannel[] = [
  'email',
  'telegram',
  'whatsapp',
  'max',
  'vk',
];

type TFn = (key: string, fallback?: string) => string;

export function buildNotifySchema(t: TFn): FieldSchema[] {
  return [
    {
      key: 'channels',
      kind: 'multiselect',
      required: true,
      labelKey: 'routes.chain.notify.channels',
      options: CHANNELS.map((channel) => ({
        value: channel,
        labelKey: `routes.chain.notify.channel.${channel}`,
        label: t(`routes.chain.notify.channel.${channel}`, channel),
      })),
    },
    {
      key: 'subject',
      kind: 'text',
      labelKey: 'routes.chain.notify.subject',
    },
    {
      key: 'body',
      kind: 'text',
      required: true,
      labelKey: 'routes.chain.notify.body',
    },
  ];
}

export function NotifyApp({ params, onChange, readOnly }: IDialplanAppProps) {
  const { t } = useTranslation();
  const schema = useMemo(() => buildNotifySchema(t), [t]);
  const channels = Array.isArray(params?.channels) ? params.channels as NotificationChannel[] : [];
  const recipients = (params?.recipients && typeof params.recipients === 'object')
    ? params.recipients as Record<string, string>
    : {};

  return (
    <div className={cls.root}>
      <SchemaFields
        schema={schema}
        params={params as Record<string, unknown>}
        readOnly={readOnly}
        onChange={onChange}
      />
      {channels.filter((channel) => RECIPIENT_CHANNELS.includes(channel)).map((channel) => (
        <Input
          key={channel}
          className={cls.target}
          value={recipients[channel] ?? ''}
          disabled={readOnly}
          aria-label={t(`routes.chain.notify.recipient.${channel}`, channel)}
          placeholder={t(`routes.chain.notify.recipient.${channel}`, channel)}
          onChange={(e) => onChange({
            recipients: { ...recipients, [channel]: e.target.value },
          })}
        />
      ))}
    </div>
  );
}
