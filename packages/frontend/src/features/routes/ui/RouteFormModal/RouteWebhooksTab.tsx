import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button, Input, Select, Text, InfoTooltip } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { WebhookAuthConfig, type AuthMode, type WebhookHeader } from '@/shared/ui/WebhookAuthConfig/WebhookAuthConfig';

export interface WebhookItem {
  id: string;
  event: string;
  url: string;
  /** Auth configuration */
  authMode: AuthMode;
  token: string;
  customHeaders: WebhookHeader[];
}

export interface RouteWebhooksTabProps {
  webhooksList: WebhookItem[];
  setWebhooksList: React.Dispatch<React.SetStateAction<WebhookItem[]>>;
}

/** Create a new empty webhook item with defaults */
const createWebhookItem = (): WebhookItem => ({
  id: Math.random().toString(),
  event: 'before_dial',
  url: '',
  authMode: 'none',
  token: '',
  customHeaders: [],
});

export const RouteWebhooksTab = memo(({ webhooksList, setWebhooksList }: RouteWebhooksTabProps) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const item = createWebhookItem();
    setWebhooksList(prev => [...prev, item]);
    setExpandedId(item.id);
  }, [setWebhooksList]);

  const handleUpdate = useCallback((id: string, field: keyof WebhookItem, value: any) => {
    setWebhooksList(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
  }, [setWebhooksList]);

  const handleRemove = useCallback((id: string) => {
    setWebhooksList(prev => prev.filter(w => w.id !== id));
    if (expandedId === id) setExpandedId(null);
  }, [setWebhooksList, expandedId]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <VStack gap="8" max>
      <HStack justify="between" align="center" max>
        <HStack gap="8" align="center">
          <Text variant="small">{t('routes.webhooksTitle', 'Настройка Webhooks')}</Text>
          <InfoTooltip text={t('routes.webhooksTooltip', 'HTTP-запросы, отправляемые при наступлении событий в маршруте. Поддерживают Bearer-авторизацию и кастомные заголовки.')} />
        </HStack>
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t('routes.addWebhook', 'Добавить вебхук')}
        </Button>
      </HStack>

      {webhooksList.length === 0 ? (
        <VStack max align="center" justify="center" className="py-8 border border-dashed border-border rounded-lg bg-background">
          <Text variant="muted">{t('routes.noWebhooks', 'Нет настроенных вебхуков')}</Text>
        </VStack>
      ) : (
        <VStack gap="8" max>
          {webhooksList.map((wh) => {
            const isExpanded = expandedId === wh.id;
            const hasAuth = wh.authMode !== 'none';

            return (
              <VStack key={wh.id} gap="0" className="border border-border rounded-lg bg-background overflow-hidden">
                {/* Main row: event + url + expand + delete */}
                <HStack gap="4" align="center" wrap="wrap" className="p-3 w-full">
                  <Select
                    value={wh.event}
                    onChange={(e) => handleUpdate(wh.id, 'event', e.target.value)}
                    className="w-full sm:w-48 shrink-0"
                  >
                    <option value="before_dial">{t('routes.whBefore', 'Перед вызовом')}</option>
                    <option value="on_answer">{t('routes.whAnswer', 'При ответе')}</option>
                    <option value="on_hangup">{t('routes.whHangup', 'При завершении')}</option>
                    <option value="custom">{t('routes.whCustom', 'Кастомный')}</option>
                  </Select>
                  <Input
                    className="flex-1 min-w-[200px]"
                    value={wh.url}
                    onChange={(e) => handleUpdate(wh.id, 'url', e.target.value)}
                    placeholder="https://..."
                  />
                  <HStack gap="4" align="center" className="shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 px-2 text-xs ${hasAuth ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => toggleExpanded(wh.id)}
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 mr-1" />
                        : <ChevronRight className="w-4 h-4 mr-1" />
                      }
                      {hasAuth
                        ? t('routes.whAuthConfigured', 'Авторизация ✓')
                        : t('routes.whAuthSetup', 'Авторизация')
                      }
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => handleRemove(wh.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </HStack>
                </HStack>

                {/* Expanded auth config */}
                {isExpanded && (
                  <VStack gap="12" className="px-3 pb-3 pt-1 border-t border-border/50 bg-muted/20">
                    <WebhookAuthConfig
                      authMode={wh.authMode}
                      token={wh.token}
                      customHeaders={wh.customHeaders}
                      onAuthModeChange={(mode) => handleUpdate(wh.id, 'authMode', mode)}
                      onTokenChange={(token) => handleUpdate(wh.id, 'token', token)}
                      onHeadersChange={(headers) => handleUpdate(wh.id, 'customHeaders', headers)}
                    />
                  </VStack>
                )}
              </VStack>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
});

RouteWebhooksTab.displayName = 'RouteWebhooksTab';
