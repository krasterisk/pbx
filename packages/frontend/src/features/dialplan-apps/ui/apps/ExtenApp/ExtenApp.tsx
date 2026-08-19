import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { Input } from '@/shared/ui/Input/Input';
import { IDialplanAppProps } from '../../../model/types';
import { useGetEndpointsQuery } from '@/shared/api/endpoints/endpointApi';

const ROUTE_PATTERN_VALUE = '__src:route_pattern';

export const ExtenApp: React.FC<IDialplanAppProps> = ({ params, onChange, readOnly, actionType }) => {
  const { t } = useTranslation();
  const { data: endpoints = [], isLoading, isError } = useGetEndpointsQuery();

  const currentValue =
    params?.target?.source === 'route_pattern' || params?.useExten
      ? ROUTE_PATTERN_VALUE
      : params?.target?.source === 'fixed'
        ? (params.target.value || '')
        : (params?.exten || '');

  const handleChange = (value: string) => {
    if (value === ROUTE_PATTERN_VALUE) {
      onChange({ target: { source: 'route_pattern' }, useExten: true, exten: '' });
    } else {
      onChange({ target: { source: 'fixed', value }, useExten: false, exten: value });
    }
  };

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="2" className="flex-1">
          {isError ? (
            <Text variant="small" className="text-destructive">{t('common.loadError', 'Ошибка загрузки')}</Text>
          ) : (
            <Select
              value={currentValue}
              onChange={(e) => handleChange(e.target.value)}
              disabled={isLoading}
            >
              <option value="" disabled>{t('routes.apps.exten.select', 'Абонент')}</option>
              <option value={ROUTE_PATTERN_VALUE}>
                {t('routes.apps.exten.modePattern', '${EXTEN} (по маске маршрута)')}
              </option>
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
