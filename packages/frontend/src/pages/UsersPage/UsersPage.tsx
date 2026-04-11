/**
 * Page: UsersPage — thin orchestrator
 *
 * Composes feature-level components.
 * No business logic — only layout and dispatch.
 */
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { usersPageActions, UsersTable, UserFormModal } from '@/features/users';

export const UsersPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      {/* Header */}
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <HStack gap="12" align="center">
          <Users className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-bold">{t('nav.users')}</h1>
        </HStack>
        <Button onClick={() => dispatch(usersPageActions.openCreateModal())}>
          <Plus className="w-4 h-4 mr-2" />
          {t('users.add')}
        </Button>
      </HStack>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <UsersTable />
      </motion.div>

      {/* Modal — reads state from Redux */}
      <UserFormModal />
    </VStack>
  );
};
