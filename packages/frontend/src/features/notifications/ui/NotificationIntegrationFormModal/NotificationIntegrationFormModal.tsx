import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { NotificationChannel } from '@krasterisk/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  Textarea,
  InfoTooltip,
} from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppSelector, useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  selectNotificationsIsModalOpen,
  selectNotificationsModalMode,
  selectNotificationsSelectedUid,
} from '../../model/selectors/notificationsPageSelectors';
import { notificationsPageActions } from '../../model/slice/notificationsPageSlice';
import {
  useGetNotificationQuery,
  useCreateNotificationMutation,
  useUpdateNotificationMutation,
} from '@/shared/api/endpoints/notificationApi';
import { CHANNEL_FIELDS, NOTIFICATION_CHANNELS } from '../../config/channelFields';
import { WebhookAuthConfig, type AuthMode, type WebhookHeader } from '@/shared/ui/WebhookAuthConfig/WebhookAuthConfig';
import cls from './NotificationIntegrationFormModal.module.scss';

/**
 * Parse webhook payload_template textarea into a JSON object.
 * Empty → omit. Invalid / non-object JSON → error.
 */
export function parseWebhookPayloadTemplate(
  raw: string,
): { ok: true; value?: Record<string, unknown> } | { ok: false; error: 'invalid' } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'invalid' };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: 'invalid' };
  }
}

export function buildIntegrationSubmitPayload(
  channel: NotificationChannel,
  fieldValues: Record<string, string>,
): { config: Record<string, unknown>; credentials: Record<string, unknown>; error?: string } {
  const config: Record<string, unknown> = {};
  const credentials: Record<string, unknown> = {};

  for (const field of CHANNEL_FIELDS[channel]) {
    const value = (fieldValues[field.key] ?? '').trim();
    if (!value) continue;

    if (field.key === 'payload_template') {
      const parsed = parseWebhookPayloadTemplate(value);
      if (!parsed.ok) return { config, credentials, error: 'payload_template_invalid' };
      if (parsed.value) config.payload_template = parsed.value;
      continue;
    }

    if (field.secret) {
      credentials[field.key] = value;
    } else {
      config[field.key] = value;
    }
  }

  return { config, credentials };
}

/** Prefill textarea from stored object or legacy string. */
export function formatPayloadTemplateForEdit(raw: unknown): string {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') {
    // Already a string — pretty-print if valid JSON object
    const parsed = parseWebhookPayloadTemplate(raw);
    if (parsed.ok && parsed.value) return JSON.stringify(parsed.value, null, 2);
    return raw;
  }
  if (typeof raw === 'object') {
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return '';
    }
  }
  return String(raw);
}

/**
 * Build the webhook-auth part of the payload (webhook channel only).
 *
 * - `auth_mode` (+ `auth_header_keys` for custom) are stored non-secret in `config`
 *   so the form can restore the mode/keys on edit.
 * - The actual `headers` object (with secret values) goes into `credentials`,
 *   which the service encrypts and WebhookProvider applies on the outbound call.
 *   Secrets never touch the dialplan — the dialplan only sends `integration_uid`.
 *
 * Returns `credentials: undefined` to signal "keep existing" (blank secrets on edit).
 */
export function buildWebhookAuthPayload(
  authMode: AuthMode,
  token: string,
  customHeaders: WebhookHeader[],
  opts: { hadAuth: boolean },
): { config: Record<string, unknown>; credentials?: Record<string, unknown> } {
  const config: Record<string, unknown> = { auth_mode: authMode };

  if (authMode === 'bearer') {
    const tok = token.trim();
    // Blank token → keep existing credentials untouched (edit) / no auth (create)
    return tok
      ? { config, credentials: { headers: { Authorization: `Bearer ${tok}` } } }
      : { config };
  }

  if (authMode === 'custom') {
    config.auth_header_keys = customHeaders.map((h) => h.key.trim()).filter(Boolean);
    const filled = customHeaders.filter((h) => h.key.trim() && h.value.trim());
    if (filled.length === 0) return { config }; // all blank → keep existing
    const headers: Record<string, string> = {};
    filled.forEach((h) => { headers[h.key.trim()] = h.value; });
    return { config, credentials: { headers } };
  }

  // none — explicitly clear stored headers only if the integration previously had auth
  return opts.hadAuth ? { config, credentials: {} } : { config };
}

export const NotificationIntegrationFormModal = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(selectNotificationsIsModalOpen);
  const mode = useAppSelector(selectNotificationsModalMode);
  const selectedUid = useAppSelector(selectNotificationsSelectedUid);

  const { data: integrationData, isFetching } = useGetNotificationQuery(selectedUid!, {
    skip: !selectedUid || mode === 'create',
  });
  const [createIntegration, { isLoading: isCreating }] = useCreateNotificationMutation();
  const [updateIntegration, { isLoading: isUpdating }] = useUpdateNotificationMutation();

  const [name, setName] = useState('');
  const [channel, setChannel] = useState<NotificationChannel>('telegram');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [authToken, setAuthToken] = useState('');
  const [customHeaders, setCustomHeaders] = useState<WebhookHeader[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'create') {
      setName('');
      setChannel('telegram');
      setFieldValues({});
      setAuthMode('none');
      setAuthToken('');
      setCustomHeaders([]);
      return;
    }

    if ((mode === 'edit' || mode === 'copy') && integrationData) {
      setName(
        mode === 'copy'
          ? `${integrationData.name} (copy)`
          : integrationData.name,
      );
      setChannel(integrationData.channel);

      const nextValues: Record<string, string> = {};
      CHANNEL_FIELDS[integrationData.channel].forEach((field) => {
        if (!field.secret) {
          const raw = integrationData.config?.[field.key];
          nextValues[field.key] =
            field.key === 'payload_template'
              ? formatPayloadTemplateForEdit(raw)
              : raw != null
                ? String(raw)
                : '';
        } else {
          nextValues[field.key] = '';
        }
      });
      setFieldValues(nextValues);

      // Restore webhook auth mode/keys (non-secret); secret values are re-entered.
      const cfgAuthMode = (integrationData.config?.auth_mode as AuthMode) ?? 'none';
      setAuthMode(cfgAuthMode === 'bearer' || cfgAuthMode === 'custom' ? cfgAuthMode : 'none');
      setAuthToken('');
      const keys = (integrationData.config?.auth_header_keys as string[] | undefined) ?? [];
      setCustomHeaders(keys.map((k) => ({ key: k, value: '' })));
    }
  }, [isOpen, mode, integrationData]);

  const handleClose = useCallback(() => {
    dispatch(notificationsPageActions.closeModal());
  }, [dispatch]);

  const handleChannelChange = (nextChannel: NotificationChannel) => {
    setChannel(nextChannel);
    if (mode === 'create') {
      const nextValues: Record<string, string> = {};
      CHANNEL_FIELDS[nextChannel].forEach((field) => {
        nextValues[field.key] = '';
      });
      setFieldValues(nextValues);
      setAuthMode('none');
      setAuthToken('');
      setCustomHeaders([]);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    const { config, credentials, error } = buildIntegrationSubmitPayload(channel, fieldValues);
    if (error === 'payload_template_invalid') {
      alert(t('notifications.payloadTemplateInvalid'));
      return;
    }
    const isCreateMode = mode === 'create' || mode === 'copy';

    let finalConfig: Record<string, unknown> = config;
    // undefined → omit credentials (keep existing on edit); object → send (may be {} to clear)
    let credentialsToSend: Record<string, unknown> | undefined =
      Object.keys(credentials).length > 0 ? credentials : undefined;

    if (channel === 'webhook') {
      const prevAuthMode = integrationData?.config?.auth_mode;
      const hadAuth = mode === 'edit' && !!prevAuthMode && prevAuthMode !== 'none';
      const auth = buildWebhookAuthPayload(authMode, authToken, customHeaders, { hadAuth });
      finalConfig = { ...config, ...auth.config };
      if (auth.credentials !== undefined) {
        credentialsToSend = { ...credentials, ...auth.credentials };
      }
    }

    try {
      if (isCreateMode) {
        await createIntegration({
          name: name.trim(),
          channel,
          config: finalConfig,
          ...(credentialsToSend !== undefined ? { credentials: credentialsToSend } : {}),
        }).unwrap();
      } else if (selectedUid) {
        await updateIntegration({
          uid: selectedUid,
          data: {
            name: name.trim(),
            channel,
            config: finalConfig,
            ...(credentialsToSend !== undefined ? { credentials: credentialsToSend } : {}),
          },
        }).unwrap();
      }
      handleClose();
    } catch (e: unknown) {
      const message =
        e && typeof e === 'object' && 'data' in e
          ? String((e as { data?: { message?: string } }).data?.message ?? 'Error')
          : 'Error';
      alert(message);
    }
  };

  const isLoading = isCreating || isUpdating || isFetching;
  const fields = CHANNEL_FIELDS[channel];

  const modalTitle =
    mode === 'edit'
      ? t('notifications.edit')
      : mode === 'copy'
        ? t('notifications.copy')
        : t('notifications.create');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
        </DialogHeader>

        <VStack gap="16" className="py-2">
          <VStack gap="4">
            <Label>{t('notifications.name')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('notifications.namePlaceholder')}
            />
          </VStack>

          <VStack gap="4">
            <div className={cls.fieldLabel}>
              <Label>{t('notifications.channel')}</Label>
            </div>
            <Select
              value={channel}
              onChange={(e) => handleChannelChange(e.target.value as NotificationChannel)}
              disabled={mode === 'edit'}
            >
              <option value="" disabled>
                {t('notifications.selectChannel')}
              </option>
              {NOTIFICATION_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {t(`notifications.channels.${ch}`, ch)}
                </option>
              ))}
            </Select>
          </VStack>

          {fields.map((field) => (
            <VStack key={field.key} gap="4" className={cls.fieldRow}>
              <div className={cls.fieldLabel}>
                <Label>{t(field.labelKey)}</Label>
                <InfoTooltip text={t(field.hintKey)} />
              </div>
              {field.key === 'payload_template' ? (
                <Textarea
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  rows={6}
                  placeholder={t('notifications.payloadTemplatePh')}
                  spellCheck={false}
                />
              ) : (
                <Input
                  type={field.secret ? 'password' : 'text'}
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  autoComplete={field.secret ? 'new-password' : 'off'}
                />
              )}
              {field.secret && mode === 'edit' && (
                <span className={cls.secretHint}>{t('notifications.secretKeepHint')}</span>
              )}
            </VStack>
          ))}

          {channel === 'webhook' && (
            <VStack gap="12" className={cls.fieldRow}>
              <div className={cls.fieldLabel}>
                <Label>{t('notifications.webhookAuthTitle', 'Авторизация вебхука')}</Label>
                <InfoTooltip text={t('notifications.webhookAuthHint', 'Заголовки авторизации хранятся в зашифрованном виде и добавляются сервером при отправке запроса на ваш URL.')} />
              </div>
              <WebhookAuthConfig
                authMode={authMode}
                token={authToken}
                customHeaders={customHeaders}
                onAuthModeChange={setAuthMode}
                onTokenChange={setAuthToken}
                onHeadersChange={setCustomHeaders}
              />
              {authMode !== 'none' && mode === 'edit' && (
                <span className={cls.secretHint}>{t('notifications.secretKeepHint')}</span>
              )}
            </VStack>
          )}
        </VStack>

        <DialogFooter className="mt-4">
          <HStack gap="8" justify="end">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
              {isLoading ? t('common.loading') : t('common.save')}
            </Button>
          </HStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
