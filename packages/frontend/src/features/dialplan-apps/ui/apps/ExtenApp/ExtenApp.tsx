import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { Input } from '@/shared/ui/Input/Input';
import { IDialplanAppProps } from '../../../model/types';
import { useGetEndpointsQuery } from '@/shared/api/endpoints/endpointApi';

export const ExtenApp: React.FC<IDialplanAppProps> = ({ action, onUpdate }) => {
  const { t } = useTranslation();
  const { data: endpoints = [], isLoading, isError } = useGetEndpointsQuery();

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="2" className="flex-1">
          {isError ? (
            <Text variant="small" className="text-destructive">{t('common.loadError', 'Ошибка загрузки')}</Text>
          ) : (
            <Select
              value={action.params?.exten || ''}
              onChange={(e) => onUpdate(action.id, 'params.exten', e.target.value)}
              disabled={isLoading}
            >
              <option value="" disabled>{t('routes.apps.exten.select', 'Абонент')}</option>
              {endpoints.map(ep => (
                <option key={ep.id} value={ep.extension}>
                  {ep.extension} {ep.callerid ? `(${ep.callerid})` : ''}
                </option>
              ))}
            </Select>
          )}
        </VStack>
      </HStack>

      <HStack gap="2" className="w-full">
        <VStack gap="2" className="w-24">
          <Input
            placeholder={t('routes.apps.common.timeout', 'Таймаут, сек')}
            type="number"
            value={action.params?.timeout || ''}
            onChange={(e) => onUpdate(action.id, 'params.timeout', e.target.value)}
          />
        </VStack>

        <VStack gap="2" className="flex-1">
          <Input
            placeholder={t('routes.apps.common.options', 'Опции (tThH)')}
            value={action.params?.options || ''}
            onChange={(e) => onUpdate(action.id, 'params.options', e.target.value)}
          />
        </VStack>
      </HStack>
    </VStack>
  );
};
