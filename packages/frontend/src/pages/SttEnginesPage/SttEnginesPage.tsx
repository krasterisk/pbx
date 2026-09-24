import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { AiProviderModal, AiProvidersTable } from '@/features/ai-providers';
import type { IAiProvider } from '@/shared/api/endpoints/aiAgentsApi';
import cls from './SttEnginesPage.module.scss';

export const SttEnginesPage = memo(() => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<IAiProvider | null | undefined>(undefined);

  return (
    <VStack gap="24" max className={cls.page} data-testid="stt-engines-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Mic size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('sttEngines.title')}
            </Text>
            <Text variant="muted">
              {t('sttEngines.subtitle')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => setEditing(null)}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('sttEngines.add')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <AiProvidersTable capability="stt" onEdit={setEditing} />
      </Flex>
      {editing !== undefined && (
        <AiProviderModal
          provider={editing}
          requiredCapability="stt"
          onClose={() => setEditing(undefined)}
        />
      )}
    </VStack>
  );
});

SttEnginesPage.displayName = 'SttEnginesPage';
