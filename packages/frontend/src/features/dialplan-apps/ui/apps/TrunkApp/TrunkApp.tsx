import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { Input } from '@/shared/ui/Input/Input';
import { IDialplanAppProps } from '../../../model/types';
import { useGetTrunksQuery } from '@/shared/api/endpoints/trunkApi';

export const TrunkApp: React.FC<IDialplanAppProps> = ({ params, onChange, readOnly, actionType }) => {
  const { t } = useTranslation();
  const { data: trunks = [], isLoading, isError } = useGetTrunksQuery();

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="2" className="flex-1">
          {isError ? (
            <Text variant="small" className="text-destructive">{t('common.loadError', 'Ошибка загрузки')}</Text>
          ) : (
            <Select
              value={params?.trunk || ''}
              onChange={(e) => onChange({ trunk: e.target.value })}
              disabled={isLoading}
            >
              <option value="" disabled>{t('routes.apps.trunk.select', 'Транк')}</option>
              {trunks.map(trunk => (
                <option key={trunk.id} value={trunk.name}>{trunk.name}</option>
              ))}
            </Select>
          )}
        </VStack>

        <VStack gap="2" className="flex-1">
          <Input
            placeholder={t('routes.apps.trunk.dest', 'Назначение')}
            value={params?.dest || ''}
            onChange={(e) => onChange({ dest: e.target.value })}
          />
        </VStack>
      </HStack>

      <HStack gap="2" className="w-full">
        <VStack gap="2" className="w-24">
          <Input
            placeholder={t('routes.apps.common.timeout', 'Таймаут, сек')}
            type="number"
            value={params?.timeout || ''}
            onChange={(e) => onChange({ timeout: e.target.value })}
          />
        </VStack>

        <VStack gap="2" className="flex-1">
          <Input
            placeholder={t('routes.apps.common.options', 'Опции (tThH)')}
            value={params?.options || ''}
            onChange={(e) => onChange({ options: e.target.value })}
          />
        </VStack>
      </HStack>
    </VStack>
  );
};
