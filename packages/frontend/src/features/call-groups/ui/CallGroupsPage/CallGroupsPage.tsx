import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Plus, UsersRound } from 'lucide-react';
import { Button, Card, CardContent } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { callGroupsPageActions } from '../../model/slice/callGroupsPageSlice';
import { CallGroupsTable } from '../CallGroupsTable/CallGroupsTable';
import { CallGroupFormModal } from '../CallGroupFormModal/CallGroupFormModal';
import cls from './CallGroupsPage.module.scss';

export const CallGroupsPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ width: '100%', minWidth: 0 }}
    >
      <VStack gap="16" max className={cls.page} data-testid="call-groups-page-responsive">
        <HStack justify="between" align="center" className="flex-col sm:flex-row gap-4 min-w-0" max>
          <HStack gap="8" align="center" className="min-w-0">
            <UsersRound className="w-6 h-6 text-primary shrink-0" />
            <h1 className="text-2xl font-bold">{t('callGroups.title', 'Группы вызовов')}</h1>
          </HStack>
          <Button
            onClick={() => dispatch(callGroupsPageActions.openCreateModal())}
            className={`gap-2 ${cls.createBtn}`}
          >
            <Plus className="w-4 h-4" />
            {t('callGroups.create', 'Создать группу')}
          </Button>
        </HStack>

        <Card className="min-w-0">
          <CardContent className={cls.cardContent}>
            <div
              className={`${cls.tableScroll} overflow-x-auto`}
              data-testid="hybrid-table"
              data-hybrid="overflow-x-auto"
            >
              <CallGroupsTable />
            </div>
          </CardContent>
        </Card>

        <CallGroupFormModal />
      </VStack>
    </motion.div>
  );
};
