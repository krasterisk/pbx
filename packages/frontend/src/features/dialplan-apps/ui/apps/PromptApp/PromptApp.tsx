import React from 'react';
import { useTranslation } from 'react-i18next';
import { VStack, HStack } from '@/shared/ui/Stack';
import { Select } from '@/shared/ui/Select/Select';
import { Text } from '@/shared/ui/Text/Text';
import { IDialplanAppProps } from '../../model/types';
import { useGetPromptsQuery } from '@/shared/api/endpoints/promptsApi';

export const PromptApp: React.FC<IDialplanAppProps> = ({ action, onUpdate }) => {
  const { t } = useTranslation();
  const { data: prompts = [], isLoading } = useGetPromptsQuery();

  return (
    <VStack gap="2" className="w-full">
      <HStack gap="2" className="w-full">
        <VStack gap="1" className="flex-1">
          <Text variant="small" className="text-muted-foreground">{t('routes.apps.prompt.select', 'Select Audio Prompt')}</Text>
          <Select
            value={action.params?.file || ''}
            onChange={(e) => onUpdate(action.id, 'params.file', e.target.value)}
            disabled={isLoading}
          >
            <option value="" disabled>---</option>
            {prompts.map(prompt => (
              <option key={prompt.uid} value={prompt.filename}>
                {prompt.original_filename} ({prompt.filename})
              </option>
            ))}
          </Select>
        </VStack>
      </HStack>
    </VStack>
  );
};
