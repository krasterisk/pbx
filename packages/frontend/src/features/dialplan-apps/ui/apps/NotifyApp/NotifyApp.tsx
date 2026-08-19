import { memo, useCallback, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Select, Textarea } from '@/shared/ui';
import { InfoTooltip } from '@/shared/ui/Tooltip/Tooltip';
import { useGetNotificationsQuery } from '@/shared/api/endpoints/notificationApi';
import {
  NOTIFY_PRESETS,
  NOTIFY_PRESET_KEYS,
  NOTIFY_PRESET_LABEL_KEYS,
  type NotifyPresetKey,
} from '../../../config/notifyPresets';
import { IDialplanAppProps } from '../../../model/types';
import cls from './NotifyApp.module.scss';

export const NotifyApp = memo(({ action, onUpdate }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const { data: integrations = [] } = useGetNotificationsQuery();

  const integrationUid = String(action.params?.integration_uid ?? '');
  const message = String(action.params?.message ?? '');
  const target = String(action.params?.target ?? '');
  const preset = String(action.params?.preset ?? '');

  const selectedIntegration = integrations.find((i) => String(i.uid) === integrationUid);
  const isWebhook = selectedIntegration?.channel === 'webhook';

  const handleIntegrationChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const nextUid = e.target.value;
      onUpdate(action.id, 'params.integration_uid', nextUid);
      const next = integrations.find((i) => String(i.uid) === nextUid);
      // Webhook has no recipient override - clear leftover target from other channels
      if (next?.channel === 'webhook' && target) {
        onUpdate(action.id, 'params.target', '');
      }
    },
    [action.id, onUpdate, integrations, target],
  );

  const handleMessageChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate(action.id, 'params.message', e.target.value);
    },
    [action.id, onUpdate],
  );

  const handleTargetChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onUpdate(action.id, 'params.target', e.target.value);
    },
    [action.id, onUpdate],
  );

  const handlePresetChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const key = e.target.value as NotifyPresetKey | '';
      onUpdate(action.id, 'params.preset', key);
      if (key && key in NOTIFY_PRESETS) {
        onUpdate(action.id, 'params.message', NOTIFY_PRESETS[key]);
      }
    },
    [action.id, onUpdate],
  );

  return (
    <div className={cls.root}>
      <div className={cls.row}>
        <Select
          className={cls.select}
          value={integrationUid}
          onChange={handleIntegrationChange}
          aria-label={t('routes.apps.notify.selectIntegration', 'Select integration')}
        >
          <option value="">
            {t('routes.apps.notify.selectIntegration', 'Select integration')}
          </option>
          {integrations.map((item) => (
            <option key={item.uid} value={String(item.uid)}>
              {item.name} ({item.channel})
            </option>
          ))}
        </Select>
        <Select
          className={cls.presets}
          value={preset}
          onChange={handlePresetChange}
          aria-label={t('routes.apps.notify.applyPreset', 'Presets')}
        >
          <option value="">
            {t('routes.apps.notify.applyPreset', 'Presets')}
          </option>
          {NOTIFY_PRESET_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(NOTIFY_PRESET_LABEL_KEYS[key], key)}
            </option>
          ))}
        </Select>
      </div>

      <div className={cls.field}>
        <div className={cls.labelRow}>
          <span>
            {isWebhook
              ? t('routes.apps.notify.messageWebhook', 'Текст уведомления')
              : t('routes.apps.notify.message', 'Шаблон сообщения')}
          </span>
          <InfoTooltip
            text={
              isWebhook
                ? t(
                    'routes.apps.notify.messageWebhookHint',
                    'Текст, который подставится в {{message}} в формате JSON интеграции webhook.\n\nПеременные Asterisk:\n${CALLERID(num)} - номер звонящего\n${CALLERID(name)} - имя\n${EXTEN} - набранный номер\n${DIALSTATUS} - статус набора\n${CDR(duration)} - длительность\n${UNIQUEID} - ID звонка\n\nФорму JSON (поля CRM) настраивайте в интеграции webhook, не здесь.',
                  )
                : t(
                    'routes.apps.notify.varsHint',
                    'Переменные Asterisk:\n${CALLERID(num)} - номер звонящего\n${CALLERID(name)} - имя\n${EXTEN} - набранный номер\n${DIALSTATUS} - статус набора\n${CDR(duration)} - длительность\n${UNIQUEID} - ID звонка',
                  )
            }
          />
        </div>
        <Textarea
          className={cls.message}
          value={message}
          onChange={handleMessageChange}
          placeholder={
            isWebhook
              ? t('routes.apps.notify.messageWebhookPh', 'Входящий звонок от ${CALLERID(num)}')
              : t('routes.apps.notify.message', 'Шаблон сообщения')
          }
          aria-label={
            isWebhook
              ? t('routes.apps.notify.messageWebhook', 'Текст уведомления')
              : t('routes.apps.notify.message', 'Шаблон сообщения')
          }
        />
      </div>

      {!isWebhook && (
        <div className={cls.row}>
          <div className={cls.field} style={{ flex: 1 }}>
            <div className={cls.labelRow}>
              <span>{t('routes.apps.notify.target', 'Переопределение получателя (опц.)')}</span>
              <InfoTooltip
                text={t(
                  'routes.apps.notify.targetHint',
                  'Необязательно. Для Telegram - другой chat_id, для email - другой адрес, для WhatsApp/MAX/VK - другой получатель. Для webhook это поле не используется: форма JSON настраивается в интеграции.',
                )}
              />
            </div>
            <Input
              className={cls.target}
              value={target}
              onChange={handleTargetChange}
              placeholder={t('routes.apps.notify.targetPh', 'chat_id / email / …')}
              aria-label={t('routes.apps.notify.target', 'Переопределение получателя (опц.)')}
            />
          </div>
        </div>
      )}
    </div>
  );
});

NotifyApp.displayName = 'NotifyApp';
