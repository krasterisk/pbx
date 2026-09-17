import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { AiProviderModal, AiProvidersTable } from '@/features/ai-providers';
import type { IAiProvider } from '@/shared/api/endpoints/aiAgentsApi';
import cls from './AiProvidersPage.module.scss';

export const AiProvidersPage = memo(() => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<IAiProvider | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <VStack gap="24" max className={cls.page} data-testid="ai-providers-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Plug size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('aiProviders.title')}
            </Text>
            <Text variant="muted">
              {t('aiProviders.subtitle')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('aiProviders.newProvider')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <AiProvidersTable
          onEdit={(provider) => {
            setEditing(provider);
            setModalOpen(true);
          }}
        />
      </Flex>

      {modalOpen && (
        <AiProviderModal
          provider={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </VStack>
  );
});

AiProvidersPage.displayName = 'AiProvidersPage';
