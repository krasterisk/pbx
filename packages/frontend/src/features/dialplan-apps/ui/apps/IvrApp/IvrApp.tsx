import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { IDialplanAppProps } from '../../model/types';
import { useGetIvrsQuery } from '@/shared/api/endpoints/ivrsApi';

export const IvrApp: React.FC<IDialplanAppProps> = ({ action, onUpdate }) => {
  const { t } = useTranslation();
  const { data: ivrs = [], isLoading } = useGetIvrsQuery();

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="1" className="flex-1">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.ivr.select', 'Select IVR')}</Text>
          <Select
            value={action.params?.ivr_uid || ''}
            onChange={(e) => onUpdate(action.id, 'params.ivr_uid', Number(e.target.value))}
            disabled={isLoading}
          >
            <option value="" disabled>---</option>
            {ivrs.map(ivr => (
              <option key={ivr.uid} value={ivr.uid}>{ivr.name}</option>
            ))}
          </Select>
        </VStack>
      </HStack>
    </VStack>
  );
};
