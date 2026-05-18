import { useTranslation } from 'react-i18next';
import { Text } from '@/shared/ui/Text/Text';
import cls from './AudioPlayer.module.scss';

export interface AudioPlayerProps {
  src: string;
  compact?: boolean;
  title?: string;
}

export function AudioPlayer({ src, compact, title }: AudioPlayerProps) {
  const { t } = useTranslation();

  if (!src) {
    return (
      <Text variant="small" className="text-muted-foreground">
        {t('recording.notAvailable', 'Запись недоступна')}
      </Text>
    );
  }

  return (
    <div className={`${cls.wrapper} ${compact ? cls.compact : ''}`}>
      {title && (
        <Text variant="small" className="text-muted-foreground mb-2 block">
          {title}
        </Text>
      )}
      <audio className={cls.audio} src={src} controls preload="metadata">
        {t('recording.notAvailable', 'Запись недоступна')}
      </audio>
    </div>
  );
}
