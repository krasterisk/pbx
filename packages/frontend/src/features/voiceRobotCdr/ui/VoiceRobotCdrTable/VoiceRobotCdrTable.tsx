import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
  Flex,
  Text,
  RecordingButton,
  Button,
} from '@/shared/ui';
import { IVoiceRobotCdr } from '@/shared/api/endpoints/voiceRobotCdrApi';
import { VoiceRobotCdrBadge } from '@/entities/voiceRobotCdr';
import { PhoneForwarded, AlertCircle, PhoneIncoming, Tag, ListTree } from 'lucide-react';

interface VoiceRobotCdrTableProps {
  data: IVoiceRobotCdr[];
  isLoading: boolean;
  onRowClick?: (cdr: IVoiceRobotCdr) => void;
}

export const VoiceRobotCdrTable = memo(({ data, isLoading, onRowClick }: VoiceRobotCdrTableProps) => {
  const { t } = useTranslation();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('voiceRobots.cdr.table.date')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.robot')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.caller')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.disposition')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.tag', 'Тег')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.duration')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.result')}</TableHead>
            <TableHead className="w-[88px]">{t('voiceRobots.cdr.table.actions', 'Действия')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-7 w-16" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (!data.length) {
    return (
      <Flex justify="center" align="center" className="py-12">
        <Text variant="muted">{t('common.noData')}</Text>
      </Flex>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('voiceRobots.cdr.table.date')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.robot')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.caller')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.disposition')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.tag', 'Тег')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.duration')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.result')}</TableHead>
            <TableHead className="w-[88px]">{t('voiceRobots.cdr.table.actions', 'Действия')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.uid}
              className="hover:bg-muted/20 transition-colors"
            >
              <TableCell className="whitespace-nowrap">
                {new Date(row.started_at).toLocaleString(t('common.locale', 'ru-RU'), {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                }).replace(',', '')}
              </TableCell>
              <TableCell>
                <div className="font-medium">{row.robot_name || `ID: ${row.robot_id}`}</div>
              </TableCell>
              <TableCell>
                <Flex align="center" gap="8">
                  <PhoneIncoming className="w-3 h-3 text-muted-foreground" />
                  <div className="font-medium">{row.caller_id || 'Скрыт'}</div>
                  {row.caller_name && row.caller_name !== row.caller_id && <div className="text-xs text-muted-foreground ml-1">({row.caller_name})</div>}
                </Flex>
              </TableCell>
              <TableCell>
                <VoiceRobotCdrBadge disposition={row.disposition} />
              </TableCell>
              <TableCell>
                {row.tags && row.tags.length > 0 ? (
                  <Flex align="center" gap="4">
                    <Tag className="w-3 h-3 text-muted-foreground" />
                    <span className="text-sm">{row.tags[row.tags.length - 1]}</span>
                  </Flex>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {formatDuration(row.duration_seconds)}
              </TableCell>
              <TableCell>
                <Flex align="center" gap="8" className="min-w-0">
                  {row.disposition === 'completed' && row.last_action === 'transfer_exten' && (
                    <Flex align="center" gap="4" className="text-sm text-muted-foreground shrink-0">
                      <PhoneForwarded className="w-3 h-3 text-indigo-500" />
                      <span>{row.transfer_target}</span>
                    </Flex>
                  )}
                  {row.disposition === 'error' && (
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    ({row.total_steps} {t('voiceRobots.cdr.table.steps', 'шагов')})
                  </span>
                </Flex>
              </TableCell>
              <TableCell className="w-[88px]">
                <Flex align="center" gap="4" className="shrink-0">
                  {row.call_uniqueid ? (
                    <RecordingButton uniqueid={row.call_uniqueid} />
                  ) : (
                    <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground">—</span>
                  )}
                  {onRowClick && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title={t('voiceRobots.cdr.detail.title', 'Детали звонка')}
                      onClick={() => onRowClick(row)}
                    >
                      <ListTree className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </Flex>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
});

VoiceRobotCdrTable.displayName = 'VoiceRobotCdrTable';
