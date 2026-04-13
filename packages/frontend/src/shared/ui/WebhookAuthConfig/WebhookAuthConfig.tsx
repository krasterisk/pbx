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

  return (
    <>
      <VStack gap="4">
        <label className="text-sm font-medium text-muted-foreground">
          {t('ttsEngines.custom.authMode', 'Авторизация')}
        </label>
        <HStack gap="8">
          {(['none', 'bearer', 'custom'] as AuthMode[]).map((am) => (
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
              {am === 'none' ? 'Нет' : am === 'bearer' ? 'Bearer' : 'Headers'}
            </button>
          ))}
        </HStack>
      </VStack>

      {authMode === 'bearer' && (
        <VStack gap="4">
          <label className="text-sm font-medium text-muted-foreground">Bearer Token</label>
          <Input type="password" value={token} onChange={(e) => onTokenChange(e.target.value)} />
        </VStack>
      )}

      {authMode === 'custom' && (
        <VStack gap="4">
          <label className="text-sm font-medium text-muted-foreground">Headers</label>
          {customHeaders.map((h, i) => (
            <HStack key={i} gap="4" align="center">
              <Input placeholder="Key" value={h.key} onChange={(e) => updateHeader(i, 'key', e.target.value)} />
              <Input placeholder="Value" value={h.value} onChange={(e) => updateHeader(i, 'value', e.target.value)} />
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
            {t('common.add')}
          </button>
        </VStack>
      )}
    </>
  );
}
