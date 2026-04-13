import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { GitMerge, Plus } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { IvrsTable, ivrsActions } from '@/features/ivrs';

export const IvrsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  
  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <GitMerge className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">{t('ivrs.title', 'Голосовые меню (IVR)')}</h1>
          </HStack>
          <p className="text-muted-foreground text-sm">
            {t('ivrs.subtitle', 'Настройка интерактивных голосовых меню')}
          </p>
        </VStack>
        <Button onClick={() => dispatch(ivrsActions.openCreateModal())}>
          <Plus className="w-4 h-4 mr-2" />
          {t('ivrs.add', 'Добавить IVR')}
        </Button>
      </HStack>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <IvrsTable />
      </motion.div>
    </VStack>
  );
});

IvrsPage.displayName = 'IvrsPage';
