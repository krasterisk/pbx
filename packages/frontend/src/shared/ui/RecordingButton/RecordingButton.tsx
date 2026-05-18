import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Text, Tooltip } from '@/shared/ui';
import { AudioPlayer } from '@/shared/ui/AudioPlayer/AudioPlayer';
import { useLazyGetCdrRecordingQuery } from '@/shared/api/endpoints/cdrApi';
import { fetchCdrRecordingBlob } from '@/shared/lib/fetchCdrRecordingBlob';
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
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [triggerFetch, { isFetching }] = useLazyGetCdrRecordingQuery();

  const revokeBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => revokeBlob(), [revokeBlob]);

  const loadPlayback = useCallback(async (uid: string) => {
    revokeBlob();
    setPlaybackUrl(null);

    try {
      const info = await triggerFetch(uid).unwrap();
      if (!info.exists) {
        return;
      }
    } catch {
      return;
    }

    const blobUrl = await fetchCdrRecordingBlob(uid);
    if (!blobUrl) {
      return;
    }
    blobUrlRef.current = blobUrl;
    setPlaybackUrl(blobUrl);
  }, [revokeBlob, triggerFetch]);

  const handleOpen = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);

    if (!uniqueid) {
      return;
    }

    await loadPlayback(uniqueid);
  }, [uniqueid, loadPlayback]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      revokeBlob();
      setPlaybackUrl(null);
    }
  }, [revokeBlob]);

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

  const showPlayer = Boolean(playbackUrl);
  const showLoading = isFetching && !playbackUrl;

  return (
    <>
      <Tooltip content={t('recording.play', 'Прослушать запись')}>{btn}</Tooltip>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('recording.play', 'Прослушать запись')}</DialogTitle>
          </DialogHeader>
          {showLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {showPlayer && <AudioPlayer src={playbackUrl!} />}
          {!showLoading && !showPlayer && (
            <Text variant="muted">{t('recording.notAvailable', 'Запись недоступна')}</Text>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});

RecordingButton.displayName = 'RecordingButton';
