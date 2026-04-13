import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Text } from '@/shared/ui/Text/Text';
import { Input } from '@/shared/ui/Input/Input';
import { IDialplanAppProps } from '../../model/types';

export const QueueApp: React.FC<IDialplanAppProps> = ({ action, onUpdate }) => {
  const { t } = useTranslation();

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="1" className="flex-1">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.queue.exten', 'Queue Number / Name')}</Text>
          <Input
            placeholder="e.g. 500"
            value={action.params?.queue || ''}
            onChange={(e) => onUpdate(action.id, 'params.queue', e.target.value)}
          />
        </VStack>

        <VStack gap="1" className="w-24">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.queue.timeout', 'Timeout')}</Text>
          <Input
            placeholder=""
            type="number"
            value={action.params?.timeout || ''}
            onChange={(e) => onUpdate(action.id, 'params.timeout', e.target.value)}
          />
        </VStack>
      </HStack>

      <HStack gap="2" className="w-full">
        <VStack gap="1" className="flex-1">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.queue.options', 'Dial Options')}</Text>
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
