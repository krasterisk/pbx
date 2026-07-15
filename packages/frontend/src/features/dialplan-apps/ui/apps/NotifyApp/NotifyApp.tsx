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

  const handleIntegrationChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      onUpdate(action.id, 'params.integration_uid', e.target.value);
    },
    [action.id, onUpdate],
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
          <span>{t('routes.apps.notify.message', 'Message template')}</span>
          <InfoTooltip
            text={t(
              'routes.apps.notify.varsHint',
              'Asterisk channel variables:\n${CALLERID(num)} - caller number\n${CALLERID(name)} - caller name\n${EXTEN} - dialed number\n${DIALSTATUS} - dial status\n${CDR(duration)} - call duration\n${UNIQUEID} - call ID',
            )}
          />
        </div>
        <Textarea
          className={cls.message}
          value={message}
          onChange={handleMessageChange}
          placeholder={t('routes.apps.notify.message', 'Message template')}
          aria-label={t('routes.apps.notify.message', 'Message template')}
        />
      </div>

      <div className={cls.row}>
        <Input
          className={cls.target}
          value={target}
          onChange={handleTargetChange}
          placeholder={t('routes.apps.notify.target', 'Target override (optional)')}
          aria-label={t('routes.apps.notify.target', 'Target override (optional)')}
        />
      </div>
    </div>
  );
});

NotifyApp.displayName = 'NotifyApp';
