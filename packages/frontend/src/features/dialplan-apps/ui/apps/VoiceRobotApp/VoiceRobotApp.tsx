import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/shared/ui';
import { IDialplanAppProps } from '../../model/types';
import { useGetVoiceRobotsQuery } from '@/shared/api/endpoints/voiceRobotsApi';

export const VoiceRobotApp = memo(({ action, onUpdate }: IDialplanAppProps) => {
  const { t } = useTranslation();
  const { data: voiceRobots, isLoading } = useGetVoiceRobotsQuery();
  const p = action.params;

  return (
    <Select
      value={p.robot_uid?.toString() || ''}
      onChange={(val) => onUpdate(action.id, 'params.robot_uid', Number(val))}
      options={[
        { value: '', label: t('routes.voicerobot.select', '-- Выберите робота --') },
        ...(voiceRobots?.map(r => ({
          value: r.uid.toString(),
          label: `${r.name} (ID: ${r.uid})`
        })) || [])
      ]}
      disabled={isLoading}
      className="w-full"
    />
  );
});

VoiceRobotApp.displayName = 'VoiceRobotApp';
