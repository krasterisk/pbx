import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { GitMerge, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useAppStore';
import { IvrsTable, IvrFormModal, ivrsActions } from '@/features/ivrs';
import {
  getIvrsIsModalOpen,
  getIvrsSelectedIvr,
  getIvrsModalMode,
} from '@/features/ivrs/model/selectors/ivrsSelectors';
import cls from './IvrsPage.module.scss';

export const IvrsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const modalOpen = useAppSelector(getIvrsIsModalOpen);
  const editIvr = useAppSelector(getIvrsSelectedIvr);
  const modalMode = useAppSelector(getIvrsModalMode);

  return (
    <VStack gap="24" max className={cls.page} data-testid="ivrs-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <GitMerge size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('ivrs.title', 'Голосовые меню (IVR)')}
            </Text>
            <Text variant="muted">
              {t('ivrs.subtitle', 'Настройка интерактивных голосовых меню')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(ivrsActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('ivrs.add', 'Добавить IVR')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <IvrsTable />
      </Flex>

      {modalOpen && (
        <IvrFormModal
          isOpen={modalOpen}
          onClose={() => dispatch(ivrsActions.closeModal())}
          ivr={editIvr}
          mode={modalMode}
        />
      )}
    </VStack>
  );
});

IvrsPage.displayName = 'IvrsPage';
