import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { List, Plus } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { NumbersTable } from '@/features/numbers';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { numbersPageActions } from '@/features/numbers';

export const NumbersPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  
  return (
    <VStack gap="24" max>
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <List className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">
              {(t('nav.numbers' as any) || 'Списки доступа')}
            </h1>
          </HStack>
          <p className="text-muted-foreground text-sm">
            Настройка списков видимости очередей, абонентов и маршрутов
          </p>
        </VStack>
        <Button className="gap-2" onClick={() => dispatch(numbersPageActions.openCreateModal())}>
          <Plus className="w-4 h-4" />
          {t('common.add')}
        </Button>
      </HStack>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <NumbersTable />
      </motion.div>
    </VStack>
  );
};


