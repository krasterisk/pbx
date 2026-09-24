import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/Button/Button';
import { Input } from '@/shared/ui/Input/Input';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { HStack, VStack } from '@/shared/ui/Stack';
import { WebhookAuthConfig, type AuthMode, type WebhookHeader } from '@/shared/ui/WebhookAuthConfig/WebhookAuthConfig';

export type WebhookListItem = {
  id: string;
  event: string;
  url: string;
  authMode: AuthMode;
  token: string;
  customHeaders: WebhookHeader[];
};

export type WebhookEventOption = {
  value: string;
  label: string;
};

export type WebhookListProps = {
  items: WebhookListItem[];
  onChange: (items: WebhookListItem[]) => void;
  events: WebhookEventOption[];
  title: string;
  tooltip: string;
  addLabel: string;
  emptyLabel: string;
};

function createItem(event: string): WebhookListItem {
  return {
    id: Math.random().toString(36).slice(2),
    event,
    url: '',
    authMode: 'none',
    token: '',
    customHeaders: [],
  };
}

export const WebhookList = memo(({
  items,
  onChange,
  events,
  title,
  tooltip,
  addLabel,
  emptyLabel,
}: WebhookListProps) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = useCallback(() => {
    const item = createItem(events[0]?.value ?? '');
    onChange([...items, item]);
    setExpandedId(item.id);
  }, [events, items, onChange]);

  const update = useCallback((id: string, patch: Partial<WebhookListItem>) => {
    onChange(items.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, [items, onChange]);

  const remove = useCallback((id: string) => {
    onChange(items.filter((row) => row.id !== id));
    setExpandedId((current) => (current === id ? null : current));
  }, [items, onChange]);

  return (
    <VStack gap="8" max>
      <HStack justify="between" align="center" max>
        <HStack gap="8" align="center">
          <Text variant="small">{title}</Text>
          <InfoTooltip text={tooltip} />
        </HStack>
        <Button size="sm" variant="outline" type="button" onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {addLabel}
        </Button>
      </HStack>

      {items.length === 0 ? (
        <VStack max align="center" justify="center" className="py-8 border border-dashed border-border rounded-lg bg-background">
          <Text variant="muted">{emptyLabel}</Text>
        </VStack>
      ) : (
        <VStack gap="8" max>
          {items.map((row) => {
            const expanded = expandedId === row.id;
            const hasAuth = row.authMode !== 'none';
            return (
              <VStack key={row.id} gap="0" className="border border-border rounded-lg bg-background overflow-hidden">
                <HStack gap="4" align="center" wrap="wrap" className="p-3 w-full">
                  <Select
                    value={row.event}
                    onChange={(e) => update(row.id, { event: e.target.value })}
                    className="w-full sm:w-48 shrink-0"
                  >
                    {events.map((event) => (
                      <option key={event.value} value={event.value}>{event.label}</option>
                    ))}
                  </Select>
                  <Input
                    className="flex-1 min-w-[200px]"
                    value={row.url}
                    onChange={(e) => update(row.id, { url: e.target.value })}
                    placeholder="https://..."
                  />
                  <HStack gap="4" align="center" className="shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className={`h-8 px-2 text-xs ${hasAuth ? 'text-primary' : 'text-muted-foreground'}`}
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                    >
                      {expanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
                      {hasAuth
                        ? t('routes.whAuthConfigured', 'Авторизация ✓')
                        : t('routes.whAuthSetup', 'Авторизация')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => remove(row.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </HStack>
                </HStack>
                {expanded ? (
                  <VStack gap="12" className="px-3 pb-3 pt-1 border-t border-border/50 bg-muted/20">
                    <WebhookAuthConfig
                      authMode={row.authMode}
                      token={row.token}
                      customHeaders={row.customHeaders}
                      onAuthModeChange={(mode) => update(row.id, { authMode: mode })}
                      onTokenChange={(token) => update(row.id, { token })}
                      onHeadersChange={(customHeaders) => update(row.id, { customHeaders })}
                    />
                  </VStack>
                ) : null}
              </VStack>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
});

WebhookList.displayName = 'WebhookList';
