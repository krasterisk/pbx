import { memo } from 'react';
import { Card, CardContent, Flex, VStack, Text } from '@/shared/ui';
import type { IKomandorClaimStats } from '@/entities/komandorClaim';

interface Props {
  stats?: IKomandorClaimStats;
  isLoading: boolean;
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <Card className="bg-background/50 flex-1 min-w-[140px]">
      <CardContent className="p-4">
        <Flex justify="between" align="center">
          <VStack>
            <Text variant="muted" className="text-xs">{label}</Text>
            <Text className={`text-2xl font-bold ${color}`}>{value}</Text>
          </VStack>
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
      <StatCard label="Всего" value={v(total)} color="" />
      <StatCard label="Новые" value={v(stats?.new)} color="text-blue-500" />
      <StatCard label="В работе" value={v(stats?.in_progress)} color="text-amber-500" />
      <StatCard label="Выполнено" value={v(stats?.completed)} color="text-green-500" />
    </div>
  );
});

KomandorClaimsStats.displayName = 'KomandorClaimsStats';
