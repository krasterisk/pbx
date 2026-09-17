import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileAudio, Phone, Upload, Volume2 } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { promptsActions } from '@/features/prompts/model/slice/promptsSlice';
import { PromptsTable } from '@/features/prompts/ui/PromptsTable';
import cls from './PromptsPage.module.scss';

export const PromptsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="prompts-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <FileAudio size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('promptsPage.title')}
            </Text>
            <Text variant="muted">
              {t('promptsPage.subtitle')}
            </Text>
          </VStack>
        </HStack>
        <HStack gap="8" className={cls.actions}>
          <Button
            className={cls.createBtn}
            onClick={() => dispatch(promptsActions.openUploadModal())}
          >
            <Upload size={16} className={cls.createBtnIcon} />
            <Text as="span">{t('promptsPage.addBtn')}</Text>
          </Button>
          <Button
            variant="outline"
            className={cls.rangeBtn}
            onClick={() => dispatch(promptsActions.openRecordModal())}
          >
            <Phone size={16} className={cls.createBtnIcon} />
            <Text as="span">{t('promptsPage.recordBtn')}</Text>
          </Button>
          <Button
            variant="outline"
            className={cls.rangeBtn}
            onClick={() => dispatch(promptsActions.openSynthesizeModal())}
          >
            <Volume2 size={16} className={cls.createBtnIcon} />
            <Text as="span">{t('promptsPage.synthesizeBtn')}</Text>
          </Button>
        </HStack>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <PromptsTable />
      </Flex>
    </VStack>
  );
});

PromptsPage.displayName = 'PromptsPage';
