import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Calendar, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { TimeGroupsTable, TimeGroupFormModal, timeGroupsActions } from '@/features/timeGroups';
import { getTimeGroupsModalOpen } from '@/features/timeGroups/model/selectors/timeGroupsSelectors';

export const TimeGroupsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modalOpen = useAppSelector(getTimeGroupsModalOpen);
  
  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <Calendar className="w-7 h-7 text-primary" />
            <Text variant="h2" as="h1">
              {t('timeGroups.title')}
            </Text>
          </HStack>
          <Text variant="muted">
            {t('timeGroups.subtitle')}
          </Text>
        </VStack>
        <Button onClick={() => dispatch(timeGroupsActions.openCreateModal())}>
          <Plus className="w-4 h-4 mr-2" />
          {t('timeGroups.add')}
        </Button>
      </HStack>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%' }}
      >
        <TimeGroupsTable />
      </motion.div>

      {modalOpen && <TimeGroupFormModal />}
    </VStack>
  );
});

TimeGroupsPage.displayName = 'TimeGroupsPage';
