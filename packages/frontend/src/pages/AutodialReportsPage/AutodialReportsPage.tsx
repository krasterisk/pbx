import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { ReportsView } from '@/features/autodial/ui/ReportsView/ReportsView';
import cls from './AutodialReportsPage.module.scss';

export const AutodialReportsPage = memo(() => {
  const { t } = useTranslation();

  return (
    <VStack gap="24" max className={cls.page} data-testid="autodial-reports-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <BarChart3 size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('autodial.reports.pageTitle')}
            </Text>
            <Text variant="muted">{t('autodial.reports.pageSubtitle')}</Text>
          </VStack>
        </HStack>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <ReportsView />
      </Flex>
    </VStack>
  );
});

AutodialReportsPage.displayName = 'AutodialReportsPage';
