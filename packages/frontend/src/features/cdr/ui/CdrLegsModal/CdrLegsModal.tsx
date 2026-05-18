import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  RecordingButton,
  ScrollArea,
} from '@/shared/ui';
import { useGetCdrLegsQuery } from '@/shared/api/endpoints/cdrApi';
import { CDR_DISPOSITION_LABELS } from '@/shared/api/endpoints/cdrApi';

interface CdrLegsModalProps {
  linkedid: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CdrLegsModal = memo(({ linkedid, isOpen, onClose }: CdrLegsModalProps) => {
  const { t } = useTranslation();
  const { data: legs = [], isLoading } = useGetCdrLegsQuery(linkedid!, { skip: !linkedid || !isOpen });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>{t('cdr.legs.title', 'Ноги звонка')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <Text variant="muted">{t('common.loading', 'Загрузка...')}</Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cdr.table.date', 'Дата')}</TableHead>
                  <TableHead>{t('cdr.table.src', 'От')}</TableHead>
                  <TableHead>{t('cdr.table.dst', 'Кому')}</TableHead>
                  <TableHead>{t('cdr.table.status', 'Статус')}</TableHead>
                  <TableHead>{t('cdr.table.recording', 'Запись')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(legs as any[]).map((leg) => (
                  <TableRow key={leg.uniqueid}>
                    <TableCell>{leg.calldate}</TableCell>
                    <TableCell>{leg.srcDisplay || leg.usrc}</TableCell>
                    <TableCell>{leg.dstDisplay || leg.dst}</TableCell>
                    <TableCell>
                      {CDR_DISPOSITION_LABELS[leg.disposition] || leg.disposition}
                    </TableCell>
                    <TableCell>
                      <RecordingButton uniqueid={leg.uniqueid} record={leg.record} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
});

CdrLegsModal.displayName = 'CdrLegsModal';
