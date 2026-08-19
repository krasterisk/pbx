import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { Input } from '@/shared/ui/Input/Input';
import { IDialplanAppProps } from '../../../model/types';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';

export const QueueApp: React.FC<IDialplanAppProps> = ({ params, onChange, readOnly, actionType }) => {
  const { t } = useTranslation();
  const { data: queues = [] } = useGetQueuesQuery();

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="2" className="flex-1">

          <Select
            value={params?.queue || ''}
            onChange={(e) => onChange({ queue: e.target.value })}
          >
            <option value="">{t('routes.apps.queue.selectQueue', 'Выберите очередь')}</option>
            {queues.map((q) => (
              <option key={q.name} value={q.name}>
                {q.exten || q.name}{q.display_name ? ` - ${q.display_name}` : ''}
              </option>
            ))}
          </Select>
        </VStack>

        <VStack gap="2" className="w-24">

          <Input
            placeholder={t('routes.apps.common.timeout', 'Таймаут, сек')}
            type="number"
            value={params?.timeout || ''}
            onChange={(e) => onChange({ timeout: e.target.value })}
          />
        </VStack>
      </HStack>

      <HStack gap="2" className="w-full">
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
