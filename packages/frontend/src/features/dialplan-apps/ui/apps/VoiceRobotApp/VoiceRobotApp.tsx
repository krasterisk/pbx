import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { IDialplanAppProps } from '../../../model/types';
import { useGetVoiceRobotsQuery } from '@/shared/api/endpoints/voiceRobotsApi';

export const VoiceRobotApp: React.FC<IDialplanAppProps> = ({ action, onUpdate }) => {
  const { t } = useTranslation();
  const { data: voiceRobots = [], isLoading, isError } = useGetVoiceRobotsQuery();

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="2" className="flex-1">

          {isError ? (
            <Text variant="small" className="text-destructive">{t('common.loadError', 'Ошибка загрузки')}</Text>
          ) : (
            <Select
              value={action.params?.robot_uid?.toString() || ''}
              onChange={(e) => onUpdate(action.id, 'params.robot_uid', Number(e.target.value))}
              disabled={isLoading}
            >
              <option value="" disabled>{t('routes.apps.voicerobot.select', 'Голосовой робот')}</option>
              {voiceRobots.map(r => (
                <option key={r.uid} value={r.uid}>{r.name} (ID: {r.uid})</option>
              ))}
            </Select>
          )}
        </VStack>
      </HStack>
    </VStack>
  );
};
