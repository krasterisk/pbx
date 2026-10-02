import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow, Text, RecordingButton, ScrollArea,
} from '@/shared/ui';
import { useGetCdrTimelineQuery, CDR_DISPOSITION_LABELS } from '@/shared/api/endpoints/cdrApi';

interface CdrLegsModalProps {
  linkedid: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const EVENT_LABELS: Record<string, string> = {
  CHAN_START: 'Создан канал',
  CHAN_END: 'Завершён канал',
  ANSWER: 'Ответ',
  HANGUP: 'Завершён вызов',
  BRIDGE_ENTER: 'Соединение',
  BRIDGE_EXIT: 'Выход из соединения',
  BLINDTRANSFER: 'Слепой перевод',
  ATTENDEDTRANSFER: 'Консультативный перевод',
  FORWARD: 'Переадресация',
  LINKEDID_END: 'Конец цепочки',
  APP_START: 'Начало действия',
  APP_END: 'Конец действия',
};

export const CdrLegsModal = memo(({ linkedid, isOpen, onClose }: CdrLegsModalProps) => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetCdrTimelineQuery(linkedid!, { skip: !linkedid || !isOpen });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="3xl">
        <DialogHeader>
          <DialogTitle>{t('cdr.legs.details', 'Детализация звонка')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          {isLoading ? <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text> : null}
          {isError ? <Text variant="muted">{t('cdr.legs.loadError', 'Не удалось загрузить историю звонка')}</Text> : null}
          {data ? (
            <>
              <Text as="h3">{t('cdr.legs.stages', 'Этапы звонка')}</Text>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t('cdr.table.date', 'Дата')}</TableHead>
                  <TableHead>{t('cdr.table.src', 'От')}</TableHead>
                  <TableHead>{t('cdr.table.dst', 'Кому')}</TableHead>
                  <TableHead>{t('cdr.legs.action', 'Действие')}</TableHead>
                  <TableHead>{t('cdr.table.status', 'Статус')}</TableHead>
                  <TableHead>{t('cdr.table.recording', 'Запись')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.legs.map((leg) => (
                    <TableRow key={leg.id}>
                      <TableCell>{leg.calldate}</TableCell>
                      <TableCell>{leg.srcDisplay || '-'}</TableCell>
                      <TableCell>{leg.dstDisplay || leg.dst || '-'}</TableCell>
                      <TableCell>{leg.lastapp || '-'}</TableCell>
                      <TableCell>{CDR_DISPOSITION_LABELS[leg.disposition] || leg.disposition}</TableCell>
                      <TableCell><RecordingButton uniqueid={leg.uniqueid} record={leg.record} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Text as="h3">{t('cdr.legs.events', 'События и переводы')}</Text>
              {data.events.length === 0 ? (
                <Text variant="muted">{t('cdr.legs.noEvents', 'Для этого звонка событий CEL нет')}</Text>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{t('cdr.table.date', 'Дата')}</TableHead>
                    <TableHead>{t('cdr.legs.event', 'Событие')}</TableHead>
                    <TableHead>{t('cdr.legs.channel', 'Канал')}</TableHead>
                    <TableHead>{t('cdr.legs.target', 'Номер / действие')}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {data.events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>{new Date(event.eventtime).toLocaleString('ru-RU')}</TableCell>
                        <TableCell>{EVENT_LABELS[event.eventtype] || event.eventtype}</TableCell>
                        <TableCell>{event.channame || '-'}</TableCell>
                        <TableCell>{[event.exten, event.appname, event.appdata, event.peer, event.extra]
                          .filter(Boolean).join(' · ') || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});

CdrLegsModal.displayName = 'CdrLegsModal';
