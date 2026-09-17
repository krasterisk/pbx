import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { AudioLines, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { ttsEnginesActions } from '@/features/tts-engines/model/slice/ttsEnginesSlice';
import { TtsEnginesTable } from '@/features/tts-engines/ui/TtsEnginesTable';
import cls from './TtsEnginesPage.module.scss';

export const TtsEnginesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="tts-engines-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <AudioLines size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('ttsEngines.title')}
            </Text>
            <Text variant="muted">
              {t('ttsEngines.subtitle')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(ttsEnginesActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('ttsEngines.add')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <TtsEnginesTable />
      </Flex>
    </VStack>
  );
});

TtsEnginesPage.displayName = 'TtsEnginesPage';
