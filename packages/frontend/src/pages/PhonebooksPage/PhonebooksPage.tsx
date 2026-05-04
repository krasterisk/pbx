import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { BookOpen, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { PhonebooksTable, PhonebookFormModal, phonebooksActions } from '@/features/phonebooks';
import { getPhonebooksModalOpen } from '@/features/phonebooks/model/selectors/phonebooksSelectors';

export const PhonebooksPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modalOpen = useAppSelector(getPhonebooksModalOpen);

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <BookOpen className="w-7 h-7 text-primary" />
            <Text variant="h2" as="h1">
              {t('phonebooks.title', 'Справочники маршрутов')}
            </Text>
          </HStack>
          <Text variant="muted">
            {t('phonebooks.subtitle', 'Списки номеров для проверки CallerID в маршрутах')}
          </Text>
        </VStack>
        <Button onClick={() => dispatch(phonebooksActions.openCreateModal())}>
          <Plus className="w-4 h-4 mr-2" />
          {t('phonebooks.add', 'Добавить справочник')}
        </Button>
      </HStack>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%' }}
      >
        <PhonebooksTable />
      </motion.div>

      {modalOpen && <PhonebookFormModal />}
    </VStack>
  );
});

PhonebooksPage.displayName = 'PhonebooksPage';
