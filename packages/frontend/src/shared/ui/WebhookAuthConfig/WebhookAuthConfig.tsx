import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Input, VStack, HStack } from '@/shared/ui';

export type AuthMode = 'none' | 'bearer' | 'custom';

export interface WebhookHeader {
  key: string;
  value: string;
}

interface WebhookAuthConfigProps {
  authMode: AuthMode;
  token: string;
  customHeaders: WebhookHeader[];
  onAuthModeChange: (mode: AuthMode) => void;
  onTokenChange: (token: string) => void;
  onHeadersChange: (headers: WebhookHeader[]) => void;
}

const AUTH_MODES: AuthMode[] = ['none', 'bearer', 'custom'];

export function WebhookAuthConfig({
  authMode,
  token,
  customHeaders,
  onAuthModeChange,
  onTokenChange,
  onHeadersChange,
}: WebhookAuthConfigProps) {
  const { t } = useTranslation();

  const addHeader = () => onHeadersChange([...customHeaders, { key: '', value: '' }]);
  
  const removeHeader = (i: number) => onHeadersChange(customHeaders.filter((_, idx) => idx !== i));
  
  const updateHeader = (i: number, field: 'key' | 'value', val: string) => {
    const copy = [...customHeaders];
    copy[i] = { ...copy[i], [field]: val };
    onHeadersChange(copy);
  };

  const authModeLabels: Record<AuthMode, string> = {
    none: t('webhookAuth.modeNone', 'Нет'),
    bearer: 'Bearer',
    custom: 'Headers',
  };

  return (
    <>
      <VStack gap="4">
        <label className="text-sm font-medium text-muted-foreground">
          {t('webhookAuth.authMode', 'Авторизация')}
        </label>
        <HStack gap="8">
          {AUTH_MODES.map((am) => (
            <button
              key={am}
              type="button"
              className={`px-3 py-1 border rounded-md text-xs transition-all ${
                authMode === am
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary'
              }`}
              onClick={() => onAuthModeChange(am)}
            >
              {authModeLabels[am]}
            </button>
          ))}
        </HStack>
      </VStack>

      {authMode === 'bearer' && (
        <VStack gap="4">
          <label className="text-sm font-medium text-muted-foreground">
            {t('webhookAuth.bearerToken', 'Bearer Token')}
          </label>
          <Input
            type="password"
            autoComplete="new-password"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder={t('webhookAuth.bearerPlaceholder', 'Вставьте токен авторизации...')}
          />
        </VStack>
      )}

      {authMode === 'custom' && (
        <VStack gap="4">
          <label className="text-sm font-medium text-muted-foreground">
            {t('webhookAuth.customHeaders', 'Пользовательские заголовки')}
          </label>
          {customHeaders.map((h, i) => (
            <HStack key={i} gap="4" align="center">
              <Input
                autoComplete="off"
                placeholder={t('webhookAuth.headerKey', 'Ключ')}
                value={h.key}
                onChange={(e) => updateHeader(i, 'key', e.target.value)}
              />
              <Input
                autoComplete="off"
                placeholder={t('webhookAuth.headerValue', 'Значение')}
                value={h.value}
                onChange={(e) => updateHeader(i, 'value', e.target.value)}
              />
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-destructive"
                onClick={() => removeHeader(i)}
              >
                <Trash2 size={14} />
              </button>
            </HStack>
          ))}
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary border border-dashed border-border rounded px-3 py-1 w-fit"
            onClick={addHeader}
          >
            <Plus size={14} />
            {t('webhookAuth.addHeader', 'Добавить заголовок')}
          </button>
        </VStack>
      )}
    </>
  );
}
