import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneCall, CheckCircle2, Clock, Timer } from 'lucide-react';
import { Flex, Text, VStack } from '@/shared/ui';
import type { ICdrStats } from '@/shared/api/endpoints/cdrApi';
import cls from './CdrStats.module.scss';

interface CdrStatsProps {
  stats?: ICdrStats;
  isLoading: boolean;
}

export const CdrStats = memo(({ stats, isLoading }: CdrStatsProps) => {
  const { t } = useTranslation();

  const items = [
    { label: t('cdr.stats.totalCalls', 'Всего звонков'), value: isLoading ? '-' : stats?.totalCalls ?? 0, icon: PhoneCall, iconClass: cls.iconIndigo },
    { label: t('cdr.stats.asr', 'ASR'), value: isLoading ? '-' : `${stats?.asr ?? 0}%`, icon: CheckCircle2, iconClass: cls.iconGreen },
    { label: t('cdr.stats.avgBillsec', 'Ср. разговор'), value: isLoading ? '-' : `${stats?.avgBillsec ?? 0} с`, icon: Clock, iconClass: cls.iconBlue },
    { label: t('cdr.stats.avgPdd', 'Ср. PDD'), value: isLoading ? '-' : `${stats?.avgPdd ?? 0} с`, icon: Timer, iconClass: cls.iconAmber },
  ];

  return (
    <VStack className={cls.grid}>
      {items.map((item) => (
        <Flex key={item.label} justify="between" align="center" className={cls.card}>
          <VStack gap="4">
            <Text className={cls.label}>{item.label}</Text>
            <Text className={cls.value}>{item.value}</Text>
          </VStack>
          <Flex align="center" justify="center" className={`${cls.iconWrap} ${item.iconClass}`}>
            <item.icon className="w-6 h-6" />
          </Flex>
        </Flex>
      ))}
    </VStack>
  );
});

CdrStats.displayName = 'CdrStats';
