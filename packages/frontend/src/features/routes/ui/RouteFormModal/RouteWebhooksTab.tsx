import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { WebhookList, type WebhookListItem } from '@/shared/ui/WebhookList/WebhookList';

export type WebhookItem = WebhookListItem;

export interface RouteWebhooksTabProps {
  webhooksList: WebhookItem[];
  setWebhooksList: React.Dispatch<React.SetStateAction<WebhookItem[]>>;
}

export const RouteWebhooksTab = memo(({ webhooksList, setWebhooksList }: RouteWebhooksTabProps) => {
  const { t } = useTranslation();
  const events = useMemo(() => ([
    { value: 'before_dial', label: t('routes.whBefore', 'Перед вызовом') },
    { value: 'on_answer', label: t('routes.whAnswer', 'При ответе') },
    { value: 'on_hangup', label: t('routes.whHangup', 'При завершении') },
    { value: 'custom', label: t('routes.whCustom', 'Кастомный') },
  ]), [t]);

  return (
    <WebhookList
      items={webhooksList}
      onChange={setWebhooksList}
      events={events}
      title={t('routes.webhooksTitle', 'Настройка Webhooks')}
      tooltip={t('routes.webhooksTooltip', 'HTTP-запросы, отправляемые при наступлении событий в маршруте. Поддерживают Bearer-авторизацию и кастомные заголовки.')}
      addLabel={t('routes.addWebhook', 'Добавить вебхук')}
      emptyLabel={t('routes.noWebhooks', 'Нет настроенных вебхуков')}
    />
  );
});

RouteWebhooksTab.displayName = 'RouteWebhooksTab';
