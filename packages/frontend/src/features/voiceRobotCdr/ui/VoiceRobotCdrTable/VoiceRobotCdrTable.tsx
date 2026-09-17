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
  Text,
  RecordingButton,
  Button,
} from '@/shared/ui';
import { Flex } from '@/shared/ui/Stack';
import { IVoiceRobotCdr } from '@/shared/api/endpoints/voiceRobotCdrApi';
import { VoiceRobotCdrBadge } from '@/entities/voiceRobotCdr';
import { PhoneForwarded, AlertCircle, PhoneIncoming, Tag, ListTree } from 'lucide-react';
import cls from './VoiceRobotCdrTable.module.scss';

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
            <TableHead>{t('voiceRobots.cdr.table.tag')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.duration')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.result')}</TableHead>
            <TableHead className={cls.actionsHead}>{t('voiceRobots.cdr.table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[1, 2, 3, 4, 5].map((i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className={cls.skelDate} /></TableCell>
              <TableCell><Skeleton className={cls.skelRobot} /></TableCell>
              <TableCell><Skeleton className={cls.skelCaller} /></TableCell>
              <TableCell><Skeleton className={cls.skelBadge} /></TableCell>
              <TableCell><Skeleton className={cls.skelTag} /></TableCell>
              <TableCell><Skeleton className={cls.skelDur} /></TableCell>
              <TableCell><Skeleton className={cls.skelResult} /></TableCell>
              <TableCell><Skeleton className={cls.skelActions} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (!data.length) {
    return (
      <Flex justify="center" align="center" className={cls.empty}>
        <Text variant="muted">{t('common.noData')}</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" align="stretch" className={cls.wrap} max>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('voiceRobots.cdr.table.date')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.robot')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.caller')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.disposition')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.tag')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.table.duration')}</TableHead>
            <TableHead>{t('voiceRobots.cdr.result')}</TableHead>
            <TableHead className={cls.actionsHead}>{t('voiceRobots.cdr.table.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.uid} className={cls.bodyRow}>
              <TableCell className={cls.nowrap}>
                <Text as="span">
                  {new Date(row.started_at).toLocaleString(t('common.locale', 'ru-RU'), {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                  }).replace(',', '')}
                </Text>
              </TableCell>
              <TableCell>
                <Text as="span" className={cls.name}>
                  {row.robot_name || `ID: ${row.robot_id}`}
                </Text>
              </TableCell>
              <TableCell>
                <Flex align="center" gap="8">
                  <PhoneIncoming size={12} className={cls.mutedIcon} />
                  <Text as="span" className={cls.name}>{row.caller_id || t('voiceRobots.cdr.hidden')}</Text>
                  {row.caller_name && row.caller_name !== row.caller_id && (
                    <Text as="span" className={cls.mutedSmall}>({row.caller_name})</Text>
                  )}
                </Flex>
              </TableCell>
              <TableCell>
                <VoiceRobotCdrBadge disposition={row.disposition} />
              </TableCell>
              <TableCell>
                {row.tags && row.tags.length > 0 ? (
                  <Flex align="center" gap="4">
                    <Tag size={12} className={cls.mutedIcon} />
                    <Text as="span" className={cls.cell}>{row.tags[row.tags.length - 1]}</Text>
                  </Flex>
                ) : (
                  <Text as="span" className={cls.mutedSmall}>-</Text>
                )}
              </TableCell>
              <TableCell>
                <Text as="span">{formatDuration(row.duration_seconds)}</Text>
              </TableCell>
              <TableCell>
                <Flex align="center" gap="8" className={cls.resultCell}>
                  {row.disposition === 'completed' && row.last_action === 'transfer_exten' && (
                    <Flex align="center" gap="4" className={cls.transfer}>
                      <PhoneForwarded size={12} className={cls.primaryIcon} />
                      <Text as="span">{row.transfer_target}</Text>
                    </Flex>
                  )}
                  {row.disposition === 'error' && (
                    <AlertCircle size={16} className={cls.dangerIcon} />
                  )}
                  <Text as="span" className={cls.mutedSmall}>
                    ({row.total_steps} {t('voiceRobots.cdr.table.steps')})
                  </Text>
                </Flex>
              </TableCell>
              <TableCell className={cls.actionsHead}>
                <Flex align="center" gap="4">
                  {row.call_uniqueid ? (
                    <RecordingButton uniqueid={row.call_uniqueid} />
                  ) : (
                    <Text as="span" className={cls.dash}>-</Text>
                  )}
                  {onRowClick && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cls.iconBtn}
                      title={t('voiceRobots.cdr.detail.title')}
                      aria-label={t('voiceRobots.cdr.detail.title')}
                      onClick={() => onRowClick(row)}
                    >
                      <ListTree size={14} />
                    </Button>
                  )}
                </Flex>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Flex>
  );
});

VoiceRobotCdrTable.displayName = 'VoiceRobotCdrTable';
