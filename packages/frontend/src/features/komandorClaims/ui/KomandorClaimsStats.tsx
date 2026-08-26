import { memo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ClipboardList, Inbox, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, Flex, VStack, Text } from '@/shared/ui';
import type { IKomandorClaimStats } from '@/entities/komandorClaim';

interface Props {
  stats?: IKomandorClaimStats;
  isLoading: boolean;
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  valueColor?: string;
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, valueColor }: StatCardProps) {
  return (
    <Card className="bg-background/50 backdrop-blur border-muted/50 flex-1 min-w-[140px]">
      <CardContent className="p-4">
        <Flex justify="between" align="center">
          <VStack>
            <Text variant="muted" className="text-xs">{label}</Text>
            <Text className={`text-2xl font-bold ${valueColor || ''}`}>{value}</Text>
          </VStack>
          <Flex align="center" justify="center" className={`p-3 sm:p-3.5 ${iconBg} rounded-full shrink-0`}>
            <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${iconColor}`} strokeWidth={2} />
          </Flex>
        </Flex>
      </CardContent>
    </Card>
  );
}

export const KomandorClaimsStats = memo(({ stats, isLoading }: Props) => {
  const total = stats ? Object.values(stats).reduce((s, n) => s + n, 0) : 0;
  const v = (n?: number) => (isLoading ? '-' : n ?? 0);
  return (
    <div className="flex flex-wrap gap-4 w-full">
      <StatCard
        label="Всего"
        value={v(total)}
        icon={ClipboardList}
        iconColor="text-emerald-500"
        iconBg="bg-emerald-500/10"
      />
      <StatCard
        label="Новые"
        value={v(stats?.new)}
        icon={Inbox}
        iconColor="text-blue-500"
        iconBg="bg-blue-500/10"
        valueColor="text-blue-500"
      />
      <StatCard
        label="В работе"
        value={v(stats?.in_progress)}
        icon={Clock}
        iconColor="text-amber-500"
        iconBg="bg-amber-500/10"
        valueColor="text-amber-500"
      />
      <StatCard
        label="Выполнено"
        value={v(stats?.completed)}
        icon={CheckCircle2}
        iconColor="text-green-500"
        iconBg="bg-green-500/10"
        valueColor="text-green-500"
      />
    </div>
  );
});

KomandorClaimsStats.displayName = 'KomandorClaimsStats';
