import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneOutgoing, Plus } from 'lucide-react';
import { Button, Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { autodialPageActions } from '@/features/autodial/model/slice/autodialPageSlice';
import { CampaignsTable } from '@/features/autodial/ui/CampaignsTable/CampaignsTable';
import { CampaignFormModal } from '@/features/autodial/ui/CampaignFormModal/CampaignFormModal';
import cls from './AutodialCampaignsPage.module.scss';

export const AutodialCampaignsPage = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  return (
    <VStack gap="24" max className={cls.page} data-testid="autodial-campaigns-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <PhoneOutgoing size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('autodial.campaigns.title')}
            </Text>
            <Text variant="muted">{t('autodial.campaigns.subtitle')}</Text>
          </VStack>
        </HStack>
        <Button
          className={cls.createBtn}
          onClick={() => dispatch(autodialPageActions.openCreateCampaign())}
        >
          <Plus size={16} className={cls.createBtnIcon} />
          <Text as="span">{t('autodial.campaigns.create')}</Text>
        </Button>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <CampaignsTable />
      </Flex>

      <CampaignFormModal />
    </VStack>
  );
});

AutodialCampaignsPage.displayName = 'AutodialCampaignsPage';
