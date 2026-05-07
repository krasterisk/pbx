import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, AlertCircle, CalendarDays } from 'lucide-react';
import { Text } from '@/shared/ui';
import { HStack, VStack } from '@/shared/ui/Stack';
import { ActionLogStats } from '../../model/types/AuditLogSchema';
import cls from './AuditLogStats.module.scss';

interface AuditLogStatsProps {
  stats?: ActionLogStats;
  isLoading: boolean;
}

const CARDS = [
  { key: 'total' as const,  icon: Activity,     labelKey: 'auditLog.statsTotal',  colorClass: 'primary' },
  { key: 'today' as const,  icon: CalendarDays, labelKey: 'auditLog.statsToday',  colorClass: 'info'    },
  { key: 'errors' as const, icon: AlertCircle,  labelKey: 'auditLog.statsErrors', colorClass: 'danger'  },
];

export const AuditLogStats = memo(({ stats, isLoading }: AuditLogStatsProps) => {
  const { t } = useTranslation();

  return (
    <HStack gap="16" max className={cls.grid}>
      {CARDS.map(({ key, icon: Icon, labelKey, colorClass }) => (
        <VStack key={key} gap="4" className={`${cls.card} ${cls[colorClass]}`}>
          <HStack gap="8" align="center">
            <Icon className={cls.icon} />
            <Text variant="muted" className={cls.label}>{t(labelKey)}</Text>
          </HStack>
          <span className={cls.value}>
            {isLoading ? '—' : (stats?.[key] ?? 0)}
          </span>
        </VStack>
      ))}
    </HStack>
  );
});

AuditLogStats.displayName = 'AuditLogStats';
