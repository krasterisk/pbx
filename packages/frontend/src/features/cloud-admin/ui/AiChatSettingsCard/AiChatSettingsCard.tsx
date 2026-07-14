import { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Card, CardHeader, CardContent, Button, Checkbox, Label, InfoTooltip, Text,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import {
  useGetAiChatSettingsQuery,
  useUpdateAiChatSettingsMutation,
} from '@/shared/api/endpoints/aiChatApi';
import cls from './AiChatSettingsCard.module.scss';

/**
 * AI Chat subsection (D-20) inside SellerSettingsForm: per-tenant confirmation
 * gate for destructive AI tool calls (D-25). Default OFF — a tenant with no
 * settings row yet gets `confirmDestructive: false` from the backend.
 *
 * @layer features/cloud-admin
 */
export const AiChatSettingsCard = memo(() => {
  const { t } = useTranslation();
  const { data, isLoading } = useGetAiChatSettingsQuery();
  const [update, { isLoading: isSaving }] = useUpdateAiChatSettingsMutation();

  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setConfirmDestructive(data.confirmDestructive);
  }, [data]);

  const handleToggle = (checked: boolean) => {
    setConfirmDestructive(checked);
    setSaved(false);
  };

  const handleSave = async () => {
    await update({ confirmDestructive }).unwrap();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (isLoading) {
    return (
      <HStack justify="center" align="center" className="h-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </HStack>
    );
  }

  return (
    <Card>
      <CardHeader>
        <HStack gap="12" align="center">
          <div className={cls.icon}>
            <Bot className="w-5 h-5" />
          </div>
          <VStack gap="2">
            <Text variant="h4">
              {t('cloudAdmin.settings.aiChat.title', 'AI Chat')}
            </Text>
            <Text variant="muted">
              {t('cloudAdmin.settings.aiChat.subtitle', 'Настройки AI-ассистента для текущего кабинета')}
            </Text>
          </VStack>
        </HStack>
      </CardHeader>

      <CardContent>
        <VStack gap="20">
          <HStack justify="between" align="center" className={cls.togglePanel}>
            <VStack gap="2">
              <HStack gap="4" align="center">
                <Label htmlFor="ai-chat-confirm-destructive">
                  {t('cloudAdmin.settings.aiChat.confirmDestructive', 'Подтверждать деструктивные операции AI')}
                </Label>
                <InfoTooltip
                  text={t(
                    'cloudAdmin.settings.aiChat.confirmDestructiveHint',
                    'По умолчанию выключено. Действует только для текущего кабинета: удаление и другие деструктивные операции AI-ассистента будут требовать явного подтверждения.',
                  )}
                />
              </HStack>
            </VStack>
            <Checkbox
              id="ai-chat-confirm-destructive"
              checked={confirmDestructive}
              onChange={(e) => handleToggle(e.target.checked)}
            />
          </HStack>

          <HStack justify="between" align="center">
            {saved && (
              <HStack gap="6" align="center" className={cls.savedMsg}>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <Text variant="muted">
                  {t('common.saved', 'Сохранено')}
                </Text>
              </HStack>
            )}
            {!saved && <span />}

            <Button
              id="ai-chat-settings-save"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t('common.saving', 'Сохранение...')}</>
                : t('common.save', 'Сохранить')
              }
            </Button>
          </HStack>
        </VStack>
      </CardContent>
    </Card>
  );
});

AiChatSettingsCard.displayName = 'AiChatSettingsCard';
