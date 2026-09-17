import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cable, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { trunksPageActions } from '../../model/slice/trunksPageSlice';
import { TrunksTable } from '../TrunksTable/TrunksTable';
import { TrunkFormModal } from '../TrunkFormModal/TrunkFormModal';
import cls from './TrunksPage.module.scss';

export const TrunksPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="trunks-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Cable size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('trunks.title', 'Транки')}
            </Text>
            <Text variant="muted">
              {t('trunks.subtitle', 'Управление SIP-транками к провайдерам')}
            </Text>
          </VStack>
        </HStack>
        <Button
          id="add-trunk-btn"
          className={cls.createBtn}
          onClick={() => dispatch(trunksPageActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('trunks.addTrunk', 'Добавить транк')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <TrunksTable />
      </Flex>

      <TrunkFormModal />
    </VStack>
  );
});

TrunksPage.displayName = 'TrunksPage';
