import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { sttEnginesActions } from '@/features/stt-engines/model/slice/sttEnginesSlice';
import { SttEnginesTable } from '@/features/stt-engines/ui/SttEnginesTable';
import cls from './SttEnginesPage.module.scss';

export const SttEnginesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="stt-engines-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Mic size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('sttEngines.title')}
            </Text>
            <Text variant="muted">
              {t('sttEngines.subtitle')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(sttEnginesActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('sttEngines.add')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <SttEnginesTable />
      </Flex>
    </VStack>
  );
});

SttEnginesPage.displayName = 'SttEnginesPage';
