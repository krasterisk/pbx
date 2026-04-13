import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { Input } from '@/shared/ui/Input/Input';
import { IDialplanAppProps } from '../../model/types';
import { useGetTrunksQuery } from '@/shared/api/endpoints/trunkApi';

export const TrunkApp: React.FC<IDialplanAppProps> = ({ action, onUpdate }) => {
  const { t } = useTranslation();
  const { data: trunks = [], isLoading } = useGetTrunksQuery();

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="1" className="flex-1">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.trunk.select', 'Select Trunk')}</Text>
          <Select
            value={action.params?.trunk || ''}
            onChange={(e) => onUpdate(action.id, 'params.trunk', e.target.value)}
            disabled={isLoading}
          >
            <option value="" disabled>---</option>
            {trunks.map(trunk => (
              <option key={trunk.id} value={trunk.id}>{trunk.name || trunk.id}</option>
            ))}
          </Select>
        </VStack>

        <VStack gap="1" className="flex-1">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.trunk.dest', 'Destination (Optional)')}</Text>
          <Input
            placeholder="${EXTEN}"
            value={action.params?.dest || ''}
            onChange={(e) => onUpdate(action.id, 'params.dest', e.target.value)}
          />
        </VStack>
      </HStack>

      <HStack gap="2" className="w-full">
        <VStack gap="1" className="w-24">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.trunk.timeout', 'Timeout')}</Text>
          <Input
            placeholder="60"
            type="number"
            value={action.params?.timeout || ''}
            onChange={(e) => onUpdate(action.id, 'params.timeout', e.target.value)}
          />
        </VStack>

        <VStack gap="1" className="flex-1">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.trunk.options', 'Dial Options')}</Text>
          <Input
            placeholder="tT"
            value={action.params?.options || ''}
            onChange={(e) => onUpdate(action.id, 'params.options', e.target.value)}
          />
        </VStack>
      </HStack>
    </VStack>
  );
};
