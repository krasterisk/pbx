/**
 * Page: NumbersPage - thin orchestrator (System module).
 */
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { List, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { NumbersTable, NumberFormModal, numbersPageActions } from '@/features/numbers';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import styles from './NumbersPage.module.scss';

export const NumbersPage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max>
      <HStack justify="between" align="center" className={styles.header} max>
        <VStack gap="4">
          <HStack gap="12" align="center">
            <List className={styles.headerIcon} />
            <Text as="h1" className={styles.title}>
              {t('nav.numbers')}
            </Text>
          </HStack>
          <Text variant="muted" className={styles.hint}>
            {t('numbers.pageHint')}
          </Text>
        </VStack>
        <Button onClick={() => dispatch(numbersPageActions.openCreateModal())}>
          <Plus className={styles.addIcon} />
          {t('numbers.add')}
        </Button>
      </HStack>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={styles.tableMotion}
      >
        <NumbersTable />
      </motion.div>

      <NumberFormModal />
    </VStack>
  );
};
