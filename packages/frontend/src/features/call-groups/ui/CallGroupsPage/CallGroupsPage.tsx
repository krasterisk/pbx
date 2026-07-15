import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Plus, UsersRound } from 'lucide-react';
import { Button, Card, CardContent } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { callGroupsPageActions } from '../../model/slice/callGroupsPageSlice';
import { CallGroupsTable } from '../CallGroupsTable/CallGroupsTable';
import { CallGroupFormModal } from '../CallGroupFormModal/CallGroupFormModal';

export const CallGroupsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <VStack gap="16" max>
        <HStack justify="between" align="center" max>
          <HStack gap="8" align="center">
            <UsersRound className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('callGroups.title', 'Группы вызовов')}</h1>
          </HStack>
          <Button
            onClick={() => dispatch(callGroupsPageActions.openCreateModal())}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('callGroups.create', 'Создать группу')}
          </Button>
        </HStack>

        <Card>
          <CardContent className="p-0">
            <CallGroupsTable />
          </CardContent>
        </Card>

        <CallGroupFormModal />
      </VStack>
    </motion.div>
  );
};
