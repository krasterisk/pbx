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
import cls from './NotificationIntegrationFormModal.module.scss';

export function buildIntegrationSubmitPayload(
  channel: NotificationChannel,
  fieldValues: Record<string, string>,
) {
  const config: Record<string, string> = {};
  const credentials: Record<string, string> = {};

  CHANNEL_FIELDS[channel].forEach((field) => {
    const value = (fieldValues[field.key] ?? '').trim();
    if (!value) return;
    if (field.secret) {
      credentials[field.key] = value;
    } else {
      config[field.key] = value;
    }
  });

  return { config, credentials };
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

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'create') {
      setName('');
      setChannel('telegram');
      setFieldValues({});
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
          nextValues[field.key] = raw != null ? String(raw) : '';
        } else {
          nextValues[field.key] = '';
        }
      });
      setFieldValues(nextValues);
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
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    const { config, credentials } = buildIntegrationSubmitPayload(channel, fieldValues);
    const isCreateMode = mode === 'create' || mode === 'copy';

    try {
      if (isCreateMode) {
        await createIntegration({
          name: name.trim(),
          channel,
          config,
          ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
        }).unwrap();
      } else if (selectedUid) {
        await updateIntegration({
          uid: selectedUid,
          data: {
            name: name.trim(),
            channel,
            config,
            ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
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
                  rows={4}
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
