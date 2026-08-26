/**
 * Page: UsersPage - thin orchestrator (System module).
 */
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Users, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { usersPageActions, UsersTable, UserFormModal } from '@/features/users';

export const UsersPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4" max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <Users className="w-7 h-7 text-primary" />
            <h1 className="text-2xl font-bold">{t('nav.users')}</h1>
          </HStack>
          <Text variant="muted" className="text-sm max-w-xl">
            {t('users.pageHint')}
          </Text>
        </VStack>
        <Button onClick={() => dispatch(usersPageActions.openCreateModal())}>
          <Plus className="w-4 h-4 mr-2" />
          {t('users.add')}
        </Button>
      </HStack>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full min-w-0"
      >
        <UsersTable />
      </motion.div>

      <UserFormModal />
    </VStack>
  );
};
