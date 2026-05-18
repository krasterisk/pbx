import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play } from 'lucide-react';
import { Button, Tooltip } from '@/shared/ui';
import { buildRecordingPlayUrl } from '@/shared/lib/cdrRecordingUrl';
import cls from './RecordingButton.module.scss';

export interface RecordingButtonProps {
  uniqueid?: string | null;
  record?: string | null;
  recordingUrl?: string | null;
  size?: 'sm' | 'icon';
  className?: string;
}

const POPUP_FEATURES = 'width=520,height=200,menubar=no,toolbar=no,location=no,status=no,resizable=yes';

export const RecordingButton = memo(({
  uniqueid,
  record,
  recordingUrl: recordingUrlProp,
  size = 'icon',
  className,
}: RecordingButtonProps) => {
  const { t } = useTranslation();

  const handlePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const src = uniqueid
      ? buildRecordingPlayUrl(uniqueid)
      : recordingUrlProp || null;
    if (!src) return;
    window.open(src, 'recording_player', POPUP_FEATURES);
  }, [uniqueid, recordingUrlProp]);

  if (!uniqueid && !record && !recordingUrlProp) {
    return null;
  }

  const btn = (
    <Button
      type="button"
      variant="ghost"
      size={size === 'icon' ? 'icon' : 'sm'}
      className={`${cls.iconBtn} ${className || ''} h-7 w-7`}
      onClick={handlePlay}
      title={t('recording.play', 'Прослушать запись')}
    >
      <Play className="w-3.5 h-3.5" />
    </Button>
  );

  return (
    <Tooltip content={t('recording.play', 'Прослушать запись')}>
      {btn}
    </Tooltip>
  );
});

RecordingButton.displayName = 'RecordingButton';
