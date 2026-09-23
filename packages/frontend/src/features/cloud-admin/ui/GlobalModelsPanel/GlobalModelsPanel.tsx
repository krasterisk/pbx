import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, VStack } from '@/shared/ui/Stack';
import { AiProviderModal, AiProvidersTable } from '@/features/ai-providers';
import type { IAiProvider } from '@/shared/api/endpoints/aiAgentsApi';

/** Superadmin catalog of model connections shared by cabinets that cannot use their own. */
export function GlobalModelsPanel() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<IAiProvider | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <VStack gap="16" max data-testid="global-models-panel">
      <Flex justify="between" align="center" max>
        <Text variant="muted">{t('platform.globalModelsHint')}</Text>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} />
          <Text as="span">{t('platform.globalModelsCreate')}</Text>
        </Button>
      </Flex>
      <AiProvidersTable
        scope="global"
        onEdit={(provider) => {
          setEditing(provider);
          setModalOpen(true);
        }}
      />
      {modalOpen && (
        <AiProviderModal
          scope="global"
          provider={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </VStack>
  );
}
