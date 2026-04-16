import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Select, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';

export interface WebhookItem {
  id: string;
  event: string;
  url: string;
}

export interface RouteWebhooksTabProps {
  webhooksList: WebhookItem[];
  setWebhooksList: React.Dispatch<React.SetStateAction<WebhookItem[]>>;
}

export const RouteWebhooksTab = memo(({ webhooksList, setWebhooksList }: RouteWebhooksTabProps) => {
  const { t } = useTranslation();

  const handleAdd = () => {
    setWebhooksList(prev => [...prev, { id: Math.random().toString(), event: 'before_dial', url: '' }]);
  };

  const handleChangeEvent = (id: string, newEvent: string) => {
    setWebhooksList(prev => prev.map(w => w.id === id ? { ...w, event: newEvent } : w));
  };

  const handleChangeUrl = (id: string, newUrl: string) => {
    setWebhooksList(prev => prev.map(w => w.id === id ? { ...w, url: newUrl } : w));
  };

  const handleRemove = (id: string) => {
    setWebhooksList(prev => prev.filter(w => w.id !== id));
  };

  return (
    <VStack gap="8" max>
      <HStack justify="between" align="center" max>
        <Text variant="small">{t('routes.webhooksTitle', 'Настройка Webhooks')}</Text>
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t('routes.addWebhook', 'Add webhook')}
        </Button>
      </HStack>
      
      {webhooksList.length === 0 ? (
        <VStack max align="center" justify="center" className="py-8 border border-dashed border-border rounded-lg bg-background">
          <Text variant="muted">{t('routes.noWebhooks', 'Нет настроенных вебхуков')}</Text>
        </VStack>
      ) : (
        <VStack gap="4" max>
          {webhooksList.map((wh) => (
            <HStack key={wh.id} gap="4" align="center" wrap="wrap" className="p-3 border border-border rounded bg-background w-full">
              <Select 
                value={wh.event} 
                onChange={(e) => handleChangeEvent(wh.id, e.target.value)}
                className="w-full sm:w-56 lg:w-48 shrink-0"
              >
                <option value="before_dial">{t('routes.whBefore', 'Перед вызовом')}</option>
                <option value="on_answer">{t('routes.whAnswer', 'При ответе')}</option>
                <option value="on_hangup">{t('routes.whHangup', 'При завершении')}</option>
                <option value="custom">{t('routes.whCustom', 'Responsible agent webhook')}</option>
              </Select>
              <Input 
                className="flex-1 min-w-[200px]"
                value={wh.url}
                onChange={(e) => handleChangeUrl(wh.id, e.target.value)}
                placeholder="https://..."
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => handleRemove(wh.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </HStack>
          ))}
        </VStack>
      )}
    </VStack>
  );
});

RouteWebhooksTab.displayName = 'RouteWebhooksTab';
