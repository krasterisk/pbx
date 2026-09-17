import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import {
  provisionTemplatesActions,
  ProvisionTemplatesTable,
  ProvisionTemplateFormModal,
} from '@/features/provisionTemplates';
import cls from './ProvisionTemplatesPage.module.scss';

export const ProvisionTemplatesPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="provision-templates-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <FileCode size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('provisionTemplates.title', 'Шаблоны автонастройки')}
            </Text>
            <Text variant="muted">
              {t('provisionTemplates.subtitle', 'XML/CFG шаблоны автонастройки SIP-телефонов')}
            </Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(provisionTemplatesActions.openCreateModal())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('provisionTemplates.add', 'Добавить шаблон')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <ProvisionTemplatesTable />
      </Flex>

      <ProvisionTemplateFormModal />
    </VStack>
  );
});

ProvisionTemplatesPage.displayName = 'ProvisionTemplatesPage';
