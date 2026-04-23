import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, Flex, VStack, Text } from '@/shared/ui';
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, Inbox } from 'lucide-react';
import type { IServiceRequestStats } from '@/entities/serviceRequest';

interface ServiceRequestsStatsProps {
  stats?: IServiceRequestStats;
  isLoading: boolean;
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: any;
  iconColor: string;
  iconBg: string;
  valueColor?: string;
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, valueColor }: StatCardProps) {
  return (
    <Card className="bg-background/50 backdrop-blur border-muted/50">
      <CardContent className="p-5">
        <Flex align="center" justify="between">
          <VStack>
            <Text variant="muted" className="text-sm font-medium mb-1">{label}</Text>
            <Text className={`text-2xl font-bold ${valueColor || ''}`}>{value}</Text>
          </VStack>
          <Flex align="center" justify="center" className={`p-3 ${iconBg} rounded-full`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </Flex>
        </Flex>
      </CardContent>
    </Card>
  );
}

export const ServiceRequestsStats = memo(({ stats, isLoading }: ServiceRequestsStatsProps) => {
  const { t } = useTranslation();

  const total = stats
    ? Object.values(stats).reduce((sum, n) => sum + n, 0)
    : 0;
  const newCount = stats?.new || 0;
  const inProgressCount = stats?.in_progress || 0;
  const completedCount = stats?.completed || 0;
  const otherCount = (stats?.postponed || 0) + (stats?.impossible || 0);

  return (
    <Flex gap="16" className="grid grid-cols-2 md:grid-cols-5">
      <StatCard
        label="Всего заявок"
        value={isLoading ? '—' : total}
        icon={ClipboardList}
        iconColor="text-indigo-500"
        iconBg="bg-indigo-500/10"
      />
      <StatCard
        label={t('serviceRequests.status.new', 'Новые')}
        value={isLoading ? '—' : newCount}
        icon={Inbox}
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
        valueColor="text-blue-500"
      />
      <StatCard
        label={t('serviceRequests.status.inProgress', 'В работе')}
        value={isLoading ? '—' : inProgressCount}
        icon={Clock}
        iconColor="text-amber-500"
        iconBg="bg-amber-500/10"
        valueColor="text-amber-500"
      />
      <StatCard
        label={t('serviceRequests.status.completed', 'Выполнено')}
        value={isLoading ? '—' : completedCount}
        icon={CheckCircle2}
        iconColor="text-green-500"
        iconBg="bg-green-500/10"
        valueColor="text-green-500"
      />
      <StatCard
        label="Прочее"
        value={isLoading ? '—' : otherCount}
        icon={AlertTriangle}
        iconColor="text-orange-500"
        iconBg="bg-orange-500/10"
        valueColor="text-orange-500"
      />
    </Flex>
  );
});

ServiceRequestsStats.displayName = 'ServiceRequestsStats';
