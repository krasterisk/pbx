import { useState, useEffect, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Card, CardHeader, CardContent, Button, Checkbox, Label, InfoTooltip, Text, Select,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppSelector } from '@/shared/hooks/useAppStore';
import { selectIsSuperAdmin } from '@/entities/User';
import {
  useGetAiChatSettingsQuery,
  useUpdateAiChatSettingsMutation,
  useGetAgentUsageQuery,
  useGetAgentUsageFunnelQuery,
  useGetAgentDefaultModelQuery,
  useUpdateAgentDefaultModelMutation,
} from '@/shared/api/endpoints/aiChatApi';
import cls from './AiChatSettingsCard.module.scss';

function rangeIso(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * Platform-administrator AI Chat card (D-07 / D-08): default model and
 * per-tenant usage. Hidden for every tenant-role session.
 *
 * @layer features/cloud-admin
 */
export const AiChatSettingsCard = memo(() => {
  const { t } = useTranslation();
  const isSuperAdmin = useAppSelector(selectIsSuperAdmin);
  const rangeState = useMemo(() => rangeIso, []);
  const [rangeDays, setRangeDays] = useState(30);
  const range = useMemo(() => rangeState(rangeDays), [rangeState, rangeDays]);

  const { data, isLoading } = useGetAiChatSettingsQuery(undefined, { skip: !isSuperAdmin });
  const [update, { isLoading: isSaving }] = useUpdateAiChatSettingsMutation();
  const { data: defaultModel } = useGetAgentDefaultModelQuery(undefined, { skip: !isSuperAdmin });
  const [saveDefaultModel] = useUpdateAgentDefaultModelMutation();
  const { data: usageRows } = useGetAgentUsageQuery(range, { skip: !isSuperAdmin });
  const { data: funnelRows } = useGetAgentUsageFunnelQuery(range, { skip: !isSuperAdmin });

  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [saved, setSaved] = useState(false);
  const [providerUid, setProviderUid] = useState<number | null>(null);

  useEffect(() => {
    if (data) setConfirmDestructive(data.confirmDestructive);
  }, [data]);

  useEffect(() => {
    if (defaultModel) setProviderUid(defaultModel.providerUid);
  }, [defaultModel]);

  const handleToggle = (checked: boolean) => {
    setConfirmDestructive(checked);
    setSaved(false);
  };

  const handleSave = async () => {
    await update({ confirmDestructive }).unwrap();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveModel = async () => {
    if (providerUid == null) return;
    await saveDefaultModel({ providerUid }).unwrap();
  };

  const funnelByTenant = useMemo(() => {
    const map = new Map((funnelRows ?? []).map((row) => [row.tenantUid, row]));
    return map;
  }, [funnelRows]);

  if (!isSuperAdmin) return null;

  if (isLoading) {
    return (
      <HStack justify="center" align="center" className={cls.loading}>
        <Loader2 className={cls.spinner} />
      </HStack>
    );
  }

  return (
    <Card>
      <CardHeader>
        <HStack gap="12" align="center">
          <VStack align="center" justify="center" className={cls.icon}>
            <Bot className={cls.iconSvg} />
          </VStack>
          <VStack gap="2">
            <Text variant="h4">
              {t('cloudAdmin.settings.aiChat.title')}
            </Text>
            <Text variant="muted">
              {t('cloudAdmin.settings.aiChat.subtitle')}
            </Text>
          </VStack>
        </HStack>
      </CardHeader>

      <CardContent>
        <VStack gap="20">
          <VStack gap="8" max className={cls.field} data-testid="ai-chat-default-model-field">
            <HStack gap="4" align="center">
              <Label htmlFor="ai-chat-default-model">
                {t('aiChat.admin.defaultModel')}
              </Label>
              <InfoTooltip text={t('aiChat.admin.defaultModelHint')} />
            </HStack>
            <HStack gap="8" align="center" max className={cls.modelRow}>
              <Select
                id="ai-chat-default-model"
                data-testid="ai-chat-default-model"
                value={providerUid ?? ''}
                onChange={(event) => setProviderUid(Number(event.target.value))}
              >
                {(defaultModel?.providers ?? []).map((provider) => (
                  <option key={provider.uid} value={provider.uid}>
                    {provider.model ?? provider.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                data-testid="ai-chat-default-model-save"
                onClick={handleSaveModel}
              >
                {t('aiChat.admin.saveModel')}
              </Button>
            </HStack>
          </VStack>

          <VStack gap="12" max data-testid="ai-chat-usage" className={cls.usage}>
            <HStack justify="between" align="center" max className={cls.usageHeader}>
              <Text variant="h4">{t('aiChat.admin.usageTitle')}</Text>
              <HStack gap="8" align="center">
                <Label htmlFor="ai-chat-usage-range">{t('aiChat.admin.range')}</Label>
                <Select
                  id="ai-chat-usage-range"
                  data-testid="ai-chat-usage-range"
                  value={String(rangeDays)}
                  onChange={(event) => setRangeDays(Number(event.target.value))}
                >
                  <option value="7">{t('aiChat.admin.range7d')}</option>
                  <option value="30">{t('aiChat.admin.range30d')}</option>
                  <option value="90">{t('aiChat.admin.range90d')}</option>
                </Select>
              </HStack>
            </HStack>

            {(usageRows ?? []).length === 0 ? (
              <Text variant="muted">{t('aiChat.admin.emptyUsage')}</Text>
            ) : (
              <VStack gap="8" max>
                {(usageRows ?? []).map((row) => {
                  const funnel = funnelByTenant.get(row.tenantUid);
                  return (
                    <VStack key={row.tenantUid} gap="4" max className={cls.usageRow}>
                      <Text variant="small">
                        {t('aiChat.admin.tenant')} {row.tenantUid}
                      </Text>
                      <Text variant="muted">
                        {t('aiChat.admin.tokensIn')} {row.tokensIn}
                        {' · '}
                        {t('aiChat.admin.tokensOut')} {row.tokensOut}
                        {' · '}
                        {t('aiChat.admin.turns')} {row.turns}
                      </Text>
                      {row.spendAvailable ? (
                        <Text variant="muted">
                          {t('aiChat.admin.spend')} {row.spendUsd}
                        </Text>
                      ) : (
                        <Text variant="muted" data-testid="ai-chat-spend-unavailable">
                          {t('aiChat.admin.spendUnavailable')}
                        </Text>
                      )}
                      {funnel && (
                        <Text variant="muted">
                          {t('aiChat.admin.funnelPending')} {funnel.pending}
                          {' · '}
                          {t('aiChat.admin.funnelApplied')} {funnel.applied}
                          {' · '}
                          {t('aiChat.admin.funnelRejected')} {funnel.rejected}
                          {' · '}
                          {t('aiChat.admin.funnelDenied')} {funnel.denied}
                        </Text>
                      )}
                    </VStack>
                  );
                })}
              </VStack>
            )}
          </VStack>

          <HStack justify="between" align="center" className={cls.togglePanel}>
            <VStack gap="2">
              <HStack gap="4" align="center">
                <Label htmlFor="ai-chat-confirm-destructive">
                  {t('cloudAdmin.settings.aiChat.confirmDestructive')}
                </Label>
                <InfoTooltip
                  text={t('cloudAdmin.settings.aiChat.confirmDestructiveHint')}
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
                <CheckCircle2 className={cls.savedIcon} />
                <Text variant="muted">
                  {t('common.saved')}
                </Text>
              </HStack>
            )}
            {!saved && <Text variant="muted">{' '}</Text>}

            <Button
              id="ai-chat-settings-save"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? t('common.saving')
                : t('common.save')}
            </Button>
          </HStack>
        </VStack>
      </CardContent>
    </Card>
  );
});

AiChatSettingsCard.displayName = 'AiChatSettingsCard';
