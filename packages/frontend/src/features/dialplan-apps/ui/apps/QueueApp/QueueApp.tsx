import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { Input } from '@/shared/ui/Input/Input';
import { IDialplanAppProps } from '../../../model/types';
import { useGetQueuesQuery } from '@/shared/api/endpoints/queueApi';

export const QueueApp: React.FC<IDialplanAppProps> = ({ action, onUpdate }) => {
  const { t } = useTranslation();
  const { data: queues = [] } = useGetQueuesQuery();

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="2" className="flex-1">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.queue.exten', 'Очередь')}</Text>
          <Select
            value={action.params?.queue || ''}
            onChange={(e) => onUpdate(action.id, 'params.queue', e.target.value)}
          >
            <option value="">{t('routes.apps.queue.selectQueue', '— Выберите очередь —')}</option>
            {queues.map((q) => (
              <option key={q.name} value={q.exten || q.name}>
                {q.exten || q.name}{q.display_name ? ` — ${q.display_name}` : ''}
              </option>
            ))}
          </Select>
        </VStack>

        <VStack gap="2" className="w-24">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.queue.timeout', 'Таймаут')}</Text>
          <Input
            placeholder=""
            type="number"
            value={action.params?.timeout || ''}
            onChange={(e) => onUpdate(action.id, 'params.timeout', e.target.value)}
          />
        </VStack>
      </HStack>

      <HStack gap="2" className="w-full">
        <VStack gap="2" className="flex-1">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.queue.options', 'Опции Dial')}</Text>
          <Input
            placeholder="thH"
            value={action.params?.options || ''}
            onChange={(e) => onUpdate(action.id, 'params.options', e.target.value)}
          />
        </VStack>
      </HStack>
    </VStack>
  );
};
