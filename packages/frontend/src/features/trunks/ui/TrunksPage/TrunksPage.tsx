import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Cable, Plus } from 'lucide-react';
import { Button } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { trunksPageActions } from '../../model/slice/trunksPageSlice';
import { TrunksTable } from '../TrunksTable/TrunksTable';
import { TrunkFormModal } from '../TrunkFormModal/TrunkFormModal';

export const TrunksPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <Cable className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">{t('trunks.title', 'Транки')}</h1>
          </HStack>
          <p className="text-muted-foreground text-sm">
            {t('trunks.subtitle', 'Внешние подключения')}
          </p>
        </VStack>
        <Button
          id="add-trunk-btn"
          onClick={() => dispatch(trunksPageActions.openCreateModal())}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('trunks.addTrunk', 'Добавить транк')}
        </Button>
      </HStack>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <TrunksTable />
      </motion.div>

      {/* Modal */}
      <TrunkFormModal />
    </VStack>
  );
});

TrunksPage.displayName = 'TrunksPage';
