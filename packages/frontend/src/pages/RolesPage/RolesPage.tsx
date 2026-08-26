/**
 * Page: RolesPage - thin orchestrator (System module).
 */
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { Shield, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { RolesTable, RoleFormModal, rolesPageActions } from '@/features/roles';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import styles from './RolesPage.module.scss';

export const RolesPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      <HStack justify="between" align="center" className={styles.header} max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <Shield className={styles.headerIcon} />
            <Text as="h1" className={styles.title}>
              {t('nav.roles')}
            </Text>
          </HStack>
          <Text variant="muted" className={styles.hint}>
            {t('roles.pageHint')}
          </Text>
        </VStack>
        <Button onClick={() => dispatch(rolesPageActions.openCreateModal())}>
          <Plus className={styles.addIcon} />
          {t('roles.add')}
        </Button>
      </HStack>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={styles.tableMotion}
      >
        <RolesTable />
      </motion.div>

      <RoleFormModal />
    </VStack>
  );
};
