/**
 * Page: EndpointsPage - thin orchestrator
 *
 * Composes feature-level components for PJSIP subscriber management.
 * No business logic - only layout and dispatch.
 */
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Phone, Plus, Layers } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  endpointsPageActions,
  EndpointsTable,
  EndpointFormModal,
  BulkCreateModal,
  SipCredentialsModal,
} from '@/features/endpoints';

export const EndpointsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className="min-w-0 max-w-full">
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4 min-w-0" max>
        <HStack gap="12" align="center">
          <Phone className="w-7 h-7 text-primary shrink-0" />
          <h1 className="text-2xl font-bold">{t('endpoints.title')}</h1>
        </HStack>
        <HStack gap="8" className="w-full sm:w-auto flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => dispatch(endpointsPageActions.openBulkModal())}
            className="w-full sm:w-auto"
          >
            <Layers className="w-4 h-4 mr-2" />
            {t('endpoints.addRange')}
          </Button>
          <Button
            onClick={() => dispatch(endpointsPageActions.openCreateModal())}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('endpoints.addEndpoint')}
          </Button>
        </HStack>
      </HStack>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <EndpointsTable />
      </motion.div>

      {/* Modals - reads state from Redux */}
      <EndpointFormModal />
      <BulkCreateModal />
      <SipCredentialsModal />
    </VStack>
  );
};
