import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, Flex, Text } from '@/shared/ui';
import { PhoneCall, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { IVoiceRobotCdrStats } from '@/shared/api/endpoints/voiceRobotCdrApi';

interface VoiceRobotCdrStatsProps {
  stats?: IVoiceRobotCdrStats;
  isLoading: boolean;
}

export const VoiceRobotCdrStats = memo(({ stats, isLoading }: VoiceRobotCdrStatsProps) => {
  const { t } = useTranslation();

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}м ${s}с`;
  };

  const successCount = stats?.byDisposition?.['completed'] || 0;
  const successRate = stats?.totalCalls ? Math.round((successCount / stats.totalCalls) * 100) : 0;
  const failedCount = 
    (stats?.byDisposition?.['error'] || 0) + 
    (stats?.byDisposition?.['fallback'] || 0) + 
    (stats?.byDisposition?.['max_steps'] || 0) +
    (stats?.byDisposition?.['caller_hangup'] || 0) +
    (stats?.byDisposition?.['timeout'] || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="bg-background/50 backdrop-blur border-muted/50">
        <CardContent className="p-6">
          <Flex align="center" justify="between">
            <div>
              <Text variant="muted" className="text-sm font-medium mb-1">
                {t('voiceRobots.cdr.stats.totalCalls')}
              </Text>
              <Text className="text-3xl font-bold">
                {isLoading ? '-' : stats?.totalCalls || 0}
              </Text>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-full">
              <PhoneCall className="w-6 h-6 text-indigo-500" />
            </div>
          </Flex>
        </CardContent>
      </Card>

      <Card className="bg-background/50 backdrop-blur border-muted/50">
        <CardContent className="p-6">
          <Flex align="center" justify="between">
            <div>
              <Text variant="muted" className="text-sm font-medium mb-1">
                {t('voiceRobots.cdr.stats.successRate')}
              </Text>
              <Flex align="baseline" gap="8">
                <Text className="text-3xl font-bold text-green-500">
                  {isLoading ? '-' : `${successRate}%`}
                </Text>
                <Text variant="muted" className="text-sm">({successCount})</Text>
              </Flex>
            </div>
            <div className="p-3 bg-green-500/10 rounded-full">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
          </Flex>
        </CardContent>
      </Card>

      <Card className="bg-background/50 backdrop-blur border-muted/50">
        <CardContent className="p-6">
          <Flex align="center" justify="between">
            <div>
              <Text variant="muted" className="text-sm font-medium mb-1">
                {t('voiceRobots.cdr.stats.avgDuration')}
              </Text>
              <Text className="text-3xl font-bold">
                {isLoading ? '-' : formatDuration(stats?.avgDuration || 0)}
              </Text>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-full">
              <Clock className="w-6 h-6 text-blue-500" />
            </div>
          </Flex>
        </CardContent>
      </Card>

      <Card className="bg-background/50 backdrop-blur border-muted/50">
        <CardContent className="p-6">
          <Flex align="center" justify="between">
            <div>
              <Text variant="muted" className="text-sm font-medium mb-1">
                {t('voiceRobots.cdr.stats.failed')}
              </Text>
              <Text className="text-3xl font-bold text-orange-500">
                {isLoading ? '-' : failedCount}
              </Text>
            </div>
            <div className="p-3 bg-orange-500/10 rounded-full">
              <AlertCircle className="w-6 h-6 text-orange-500" />
            </div>
          </Flex>
        </CardContent>
      </Card>
    </div>
  );
});

VoiceRobotCdrStats.displayName = 'VoiceRobotCdrStats';
