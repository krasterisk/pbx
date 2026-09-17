import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge } from 'lucide-react';
import { Text } from '@/shared/ui';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { MonitorBoard } from '@/features/autodial/ui/MonitorBoard/MonitorBoard';
import cls from './AutodialMonitorPage.module.scss';

export const AutodialMonitorPage = memo(() => {
  const { t } = useTranslation();

  return (
    <VStack gap="24" max className={cls.page} data-testid="autodial-monitor-page-responsive">
      <Flex justify="between" align="center" className={cls.header} max>
        <HStack gap="12" align="center">
          <Flex align="center" justify="center" className={cls.iconBadge}>
            <Gauge size={24} />
          </Flex>
          <VStack gap="4" className={cls.titleBlock}>
            <Text variant="h1" as="h1" className={cls.title}>
              {t('autodial.monitor.pageTitle')}
            </Text>
            <Text variant="muted">{t('autodial.monitor.pageSubtitle')}</Text>
          </VStack>
        </HStack>
      </Flex>

      <Flex direction="column" align="stretch" max className={cls.tableWrap}>
        <MonitorBoard />
      </Flex>
    </VStack>
  );
});

AutodialMonitorPage.displayName = 'AutodialMonitorPage';
