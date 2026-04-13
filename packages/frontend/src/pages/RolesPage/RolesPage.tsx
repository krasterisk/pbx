import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Shield, Plus } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { RolesTable } from '@/features/roles';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { rolesPageActions } from '@/features/roles';

export const RolesPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  
  return (
    <VStack gap="24" max>
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <HStack gap="12" align="center">
          <Shield className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">
            {(t('nav.roles' as any) || 'Интерфейсы')}
          </h1>
        </HStack>
        <Button className="gap-2" onClick={() => dispatch(rolesPageActions.openCreateModal())}>
          <Plus className="w-4 h-4" />
          {t('common.add')}
        </Button>
      </HStack>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <RolesTable />
      </motion.div>
    </VStack>
  );
};


