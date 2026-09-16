import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import {
  conferenceMeetingPlayUrl,
  useGetConferenceRecordingsByUniqueidQuery,
} from '@/shared/api/endpoints/conferenceMeetingsApi';
import { getAuthApiBase } from '@/shared/api/apiBase';
import { Button, Text } from '@/shared/ui';
import { AudioPlayer } from '@/shared/ui/AudioPlayer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog';
import cls from './ConferenceRecordingModal.module.scss';

export interface ConferenceRecordingModalProps {
  uniqueid: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function jwtPlaySrc(roomUid: number, meetingUid: number, download = false): string {
  const path = conferenceMeetingPlayUrl(
    roomUid,
    meetingUid,
    download ? { download: true } : undefined,
  );
  const base = getAuthApiBase();
  let url = `${base}${path}`;
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) {
    url += `${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  }
  return url;
}

export const ConferenceRecordingModal = memo(({
  uniqueid,
  isOpen,
  onClose,
}: ConferenceRecordingModalProps) => {
  const { t } = useTranslation();
  const { data } = useGetConferenceRecordingsByUniqueidQuery(uniqueid ? [uniqueid] : [], {
    skip: !uniqueid || !isOpen,
  });

  const match = data?.[0];
  const playSrc = match ? jwtPlaySrc(match.roomUid, match.meetingUid) : '';
  const downloadHref = match ? jwtPlaySrc(match.roomUid, match.meetingUid, true) : '';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="large">
        <DialogHeader>
          <DialogTitle>
            {t('conferences.cdr.detailsTitle', 'Запись конференции')}
          </DialogTitle>
        </DialogHeader>

        <div className={cls.scrollBody}>
          {match ? (
            <div className={cls.playerRow}>
              <AudioPlayer src={playSrc} />
              {downloadHref ? (
                <Button asChild variant="outline" size="sm" className={cls.download}>
                  <a href={downloadHref} download>
                    <Download size={16} />
                    <Text as="span">{t('conferences.cdr.download', 'Скачать')}</Text>
                  </a>
                </Button>
              ) : null}
            </div>
          ) : (
            <Text className={cls.empty}>
              {t('conferences.cdr.empty', 'Запись конференции недоступна')}
            </Text>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

ConferenceRecordingModal.displayName = 'ConferenceRecordingModal';
