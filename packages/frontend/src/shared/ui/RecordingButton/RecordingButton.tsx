import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Text, Tooltip } from '@/shared/ui';
import { AudioPlayer } from '@/shared/ui/AudioPlayer/AudioPlayer';
import { useLazyGetCdrRecordingQuery } from '@/shared/api/endpoints/cdrApi';
import { resolveCdrRecordingPlaybackUrl } from '@/shared/lib/cdrRecordingUrl';
import cls from './RecordingButton.module.scss';

export interface RecordingButtonProps {
  uniqueid?: string | null;
  record?: string | null;
  recordingUrl?: string | null;
  size?: 'sm' | 'icon';
  className?: string;
}

export const RecordingButton = memo(({
  uniqueid,
  record,
  recordingUrl: recordingUrlProp,
  size = 'icon',
  className,
}: RecordingButtonProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(recordingUrlProp || null);
  const [triggerFetch, { isFetching }] = useLazyGetCdrRecordingQuery();

  const handleOpen = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (recordingUrlProp) {
      setPlaybackUrl(resolveCdrRecordingPlaybackUrl(recordingUrlProp, uniqueid));
      setOpen(true);
      return;
    }
    if (record && !uniqueid) {
      setOpen(true);
      return;
    }
    if (!uniqueid) return;

    try {
      const info = await triggerFetch(uniqueid).unwrap();
      const url = resolveCdrRecordingPlaybackUrl(info.recordingUrl, info.uniqueid || uniqueid);
      setPlaybackUrl(url);
      setOpen(info.exists || Boolean(url));
    } catch {
      setPlaybackUrl(resolveCdrRecordingPlaybackUrl(null, uniqueid));
      setOpen(true);
    }
  }, [uniqueid, record, recordingUrlProp, triggerFetch]);

  if (!uniqueid && !record && !recordingUrlProp) {
    return null;
  }

  const btn = (
    <Button
      type="button"
      variant="ghost"
      size={size === 'icon' ? 'icon' : 'sm'}
      className={`${cls.iconBtn} ${className || ''} h-7 w-7`}
      onClick={handleOpen}
      disabled={isFetching}
      title={t('recording.play', 'Прослушать запись')}
    >
      {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
    </Button>
  );

  return (
    <>
      <Tooltip content={t('recording.play', 'Прослушать запись')}>{btn}</Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('recording.play', 'Прослушать запись')}</DialogTitle>
          </DialogHeader>
          {playbackUrl ? (
            <AudioPlayer src={playbackUrl} />
          ) : (
            <Text variant="muted">{t('recording.notAvailable', 'Запись недоступна')}</Text>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});

RecordingButton.displayName = 'RecordingButton';
