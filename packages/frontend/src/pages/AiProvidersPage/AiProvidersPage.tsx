import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { AiProviderModal, AiProvidersTable } from '@/features/ai-providers';
import type { IAiProvider } from '@/shared/api/endpoints/aiAgentsApi';
import styles from './AiProvidersPage.module.scss';

export function AiProvidersPage() {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<IAiProvider | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <VStack gap="24" max className={styles.page} data-testid="ai-providers-page-responsive">
      <HStack justify="between" align="center" className={styles.header} max>
        <VStack gap="4" className={styles.heading}>
          <HStack gap="12" align="center">
            <Plug className={styles.pageIcon} />
            <Text variant="h1" className={styles.pageTitle}>
              {t('aiProviders.title')}
            </Text>
          </HStack>
          <Text variant="small" className={styles.pageSubtitle}>
            {t('aiProviders.subtitle')}
          </Text>
        </VStack>
        <Button
          className={styles.createBtn}
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className={styles.btnIcon} />
          {t('aiProviders.newProvider')}
        </Button>
      </HStack>

      <VStack
        className={styles.tableScroll}
        data-testid="hybrid-table"
        data-hybrid="overflow-x-auto"
        max
      >
        <AiProvidersTable
          onEdit={(provider) => {
            setEditing(provider);
            setModalOpen(true);
          }}
        />
      </VStack>

      {modalOpen && (
        <AiProviderModal
          provider={editing}
          onClose={() => setModalOpen(false)}
        />
      )}
    </VStack>
  );
}
