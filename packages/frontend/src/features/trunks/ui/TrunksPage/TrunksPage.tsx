import { memo } from 'react';
import { useTranslation } from 'react-i18next';
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
    <VStack gap="24" className="p-4 sm:p-6 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <HStack justify="between" align="center" max className="flex-col sm:flex-row gap-4">
        <HStack gap="12" align="center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
            <Cable className="w-5 h-5 text-primary" />
          </div>
          <VStack gap="4">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {t('trunks.title')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('trunks.subtitle')}
            </p>
          </VStack>
        </HStack>
        <Button
          id="add-trunk-btn"
          onClick={() => dispatch(trunksPageActions.openCreateModal())}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t('trunks.addTrunk')}
        </Button>
      </HStack>

      {/* Table */}
      <TrunksTable />

      {/* Modal */}
      <TrunkFormModal />
    </VStack>
  );
});

TrunksPage.displayName = 'TrunksPage';
