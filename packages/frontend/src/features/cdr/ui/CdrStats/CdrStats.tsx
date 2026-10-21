import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneCall, CheckCircle2, Clock, Timer } from 'lucide-react';
import { Flex, Text, VStack } from '@/shared/ui';
import type { ICdrStats } from '@/shared/api/endpoints/cdrApi';
import cls from './CdrStats.module.scss';

interface CdrStatsProps {
  stats?: ICdrStats;
  isLoading: boolean;
  isError?: boolean;
}

const UNAVAILABLE = '—';

export const CdrStats = memo(({ stats, isLoading, isError }: CdrStatsProps) => {
  const { t } = useTranslation();
  const missing = isLoading || isError || !stats;

  const items = [
    { label: t('cdr.stats.totalCalls', 'Всего звонков'), value: missing ? UNAVAILABLE : stats.totalCalls, icon: PhoneCall, iconClass: cls.iconIndigo },
    { label: t('cdr.stats.asr', 'ASR'), value: missing ? UNAVAILABLE : `${stats.asr}%`, icon: CheckCircle2, iconClass: cls.iconGreen },
    { label: t('cdr.stats.avgBillsec', 'Ср. разговор'), value: missing ? UNAVAILABLE : `${stats.avgBillsec} с`, icon: Clock, iconClass: cls.iconBlue },
    { label: t('cdr.stats.avgPdd', 'Ср. PDD'), value: missing ? UNAVAILABLE : `${stats.avgPdd} с`, icon: Timer, iconClass: cls.iconAmber },
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
