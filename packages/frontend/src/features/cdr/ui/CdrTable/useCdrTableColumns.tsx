import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { PhoneForwarded, Voicemail } from 'lucide-react';
import { Badge, Button, RecordingButton, Text } from '@/shared/ui';
import { Flex, VStack } from '@/shared/ui/Stack';
import { CDR_DISPOSITION_LABELS, type ICdrCall } from '@/shared/api/endpoints/cdrApi';
import type { CdrTableRow } from './CdrTable';
import cls from './CdrTable.module.scss';

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface ColumnsArgs {
  onLegsClick?: (call: ICdrCall) => void;
  onVoicemailClick?: (uniqueid: string) => void;
  onOpenAnalytics?: (conversationId: string) => void;
  onRequestGetAnalytics?: (row: CdrTableRow) => void;
  getAnalyticsBusyUniqueid?: string | null;
  analyticsStartErrorByUniqueid?: Record<string, string>;
}

export const useCdrTableColumns = ({
  onLegsClick,
  onVoicemailClick,
  onOpenAnalytics,
  onRequestGetAnalytics,
  getAnalyticsBusyUniqueid,
  analyticsStartErrorByUniqueid,
}: ColumnsArgs) => {
  const { t } = useTranslation();

  return useMemo<ColumnDef<CdrTableRow>[]>(() => [
    {
      accessorKey: 'calldate',
      header: t('cdr.table.date', 'Дата'),
      cell: ({ row }) => (
        <Text as="span" className={cls.nowrap}>
          {new Date(row.original.calldate).toLocaleString('ru-RU')}
        </Text>
      ),
    },
    {
      accessorKey: 'srcDisplay',
      header: t('cdr.table.src', 'Кто звонил'),
      cell: ({ row }) => <Text as="span" className={cls.cell}>{row.original.srcDisplay}</Text>,
    },
    {
      accessorKey: 'dstDisplay',
      header: t('cdr.table.dst', 'Куда'),
      cell: ({ row }) => <Text as="span" className={cls.cell}>{row.original.dstDisplay}</Text>,
    },
    {
      accessorKey: 'dialednum',
      header: t('cdr.table.line', 'Линия'),
      cell: ({ row }) => (
        <Text as="span" className={cls.muted}>{row.original.dialednum || '-'}</Text>
      ),
    },
    {
      accessorKey: 'disposition',
      header: t('cdr.table.status', 'Статус'),
      cell: ({ row }) => (
        <Badge variant={row.original.answered ? 'default' : 'secondary'}>
          {CDR_DISPOSITION_LABELS[row.original.disposition] || row.original.disposition}
        </Badge>
      ),
    },
    {
      accessorKey: 'billsec',
      header: t('cdr.table.duration', 'Длительность'),
      cell: ({ row }) => (
        <Text as="span" className={cls.cell}>
          {formatDuration(row.original.billsec || row.original.duration)}
        </Text>
      ),
    },
    {
      id: 'recording',
      header: t('cdr.table.recording', 'Запись'),
      cell: ({ row }) => (
        <FlexRecording
          uniqueid={row.original.uniqueid}
          record={row.original.record}
          recordingUrl={row.original.recordingUrl}
          hasVoicemail={!!row.original.hasVoicemail}
          onVoicemailClick={() => onVoicemailClick?.(row.original.uniqueid)}
          detailsTitle={t('cdr.voicemail.detailsTitle', 'Детали сообщения')}
          journalConversationId={row.original.journalConversationId}
          speechAnalyticsActive={row.original.speechAnalyticsActive === true}
          hasRecording={row.original.hasRecording === true || Boolean(row.original.record || row.original.recordingUrl)}
          getAnalyticsBusy={getAnalyticsBusyUniqueid === row.original.uniqueid}
          analyticsStartError={analyticsStartErrorByUniqueid?.[row.original.uniqueid]}
          openAnalyticsLabel={t('speechAnalytics.openAnalytics', 'Аналитика')}
          getAnalyticsLabel={t('speechAnalytics.getAnalytics', 'Получить аналитику')}
          getAnalyticsBusyLabel={t('speechAnalytics.getAnalyticsBusy', 'Получение...')}
          onOpenAnalytics={onOpenAnalytics}
          onRequestGetAnalytics={() => onRequestGetAnalytics?.(row.original)}
        />
      ),
    },
    {
      id: 'transfer',
      header: '',
      size: 48,
      cell: ({ row }) =>
        row.original.transid ? (
          <Button
            variant="ghost"
            size="icon"
            className={cls.iconBtn}
            onClick={() => onLegsClick?.(row.original)}
            title={t('cdr.legs.title', 'История переводов')}
          >
            <PhoneForwarded size={14} />
          </Button>
        ) : null,
    },
  ], [
    t,
    onLegsClick,
    onVoicemailClick,
    onOpenAnalytics,
    onRequestGetAnalytics,
    getAnalyticsBusyUniqueid,
    analyticsStartErrorByUniqueid,
  ]);
};

function FlexRecording({
  uniqueid,
  record,
  recordingUrl,
  hasVoicemail,
  onVoicemailClick,
  detailsTitle,
  journalConversationId,
  speechAnalyticsActive,
  hasRecording,
  getAnalyticsBusy,
  analyticsStartError,
  openAnalyticsLabel,
  getAnalyticsLabel,
  getAnalyticsBusyLabel,
  onOpenAnalytics,
  onRequestGetAnalytics,
}: {
  uniqueid: string;
  record?: string | null;
  recordingUrl?: string | null;
  hasVoicemail: boolean;
  onVoicemailClick: () => void;
  detailsTitle: string;
  journalConversationId?: string | null;
  speechAnalyticsActive: boolean;
  hasRecording: boolean;
  getAnalyticsBusy: boolean;
  analyticsStartError?: string;
  openAnalyticsLabel: string;
  getAnalyticsLabel: string;
  getAnalyticsBusyLabel: string;
  onOpenAnalytics?: (conversationId: string) => void;
  onRequestGetAnalytics: () => void;
}) {
  const showOpenAnalytics = Boolean(journalConversationId);
  // D-18: recording + module active. D-19: company pause must NOT hide this.
  const showGetAnalytics = hasRecording && speechAnalyticsActive;

  return (
    <VStack gap="4" className={cls.recordingStack}>
      <Flex align="center" className={cls.recordingCell}>
        <RecordingButton uniqueid={uniqueid} record={record} recordingUrl={recordingUrl} />
        {showOpenAnalytics ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cls.analyticsActionBtn}
            onClick={(e) => {
              e.stopPropagation();
              onOpenAnalytics?.(String(journalConversationId));
            }}
          >
            {openAnalyticsLabel}
          </Button>
        ) : null}
        {showGetAnalytics ? (
          <Button
            type="button"
            variant="default"
            size="sm"
            className={cls.analyticsActionBtn}
            disabled={getAnalyticsBusy}
            onClick={(e) => {
              e.stopPropagation();
              onRequestGetAnalytics();
            }}
          >
            {getAnalyticsBusy ? getAnalyticsBusyLabel : getAnalyticsLabel}
          </Button>
        ) : null}
        {hasVoicemail ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cls.voicemailBtn}
            title={detailsTitle}
            aria-label={detailsTitle}
            onClick={(e) => {
              e.stopPropagation();
              onVoicemailClick();
            }}
          >
            <Voicemail size={14} className={cls.voicemailIcon} />
          </Button>
        ) : null}
      </Flex>
      {analyticsStartError ? (
        <Text as="span" variant="muted" className={cls.analyticsError} data-testid={`cdr-analytics-error-${uniqueid}`}>
          {analyticsStartError}
        </Text>
      ) : null}
    </VStack>
  );
}
