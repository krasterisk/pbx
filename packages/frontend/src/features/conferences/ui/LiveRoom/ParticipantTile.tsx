import { useTranslation } from 'react-i18next';
import { Avatar } from '@/shared/ui/Avatar';
import { Text } from '@/shared/ui/Text/Text';
import { Flex, VStack } from '@/shared/ui/Stack';
import { VideoSurface } from '@/shared/ui/VideoSurface';
import { classNames } from '@/shared/lib/classNames/classNames';
import type { LiveRoomParticipant } from './LiveRoom';
import cls from './ParticipantTile.module.scss';

export interface ParticipantTileProps {
  mid: string;
  participant: LiveRoomParticipant;
  track?: MediaStreamTrack;
  single?: boolean;
}

export function ParticipantTile({ mid, participant, track, single }: ParticipantTileProps) {
  const { t } = useTranslation();
  const showVideo = Boolean(participant.video && track);

  return (
    <Flex
      role="listitem"
      direction="column"
      align="stretch"
      data-mid={mid}
      aria-current={participant.speaking ? true : undefined}
      className={classNames(cls.tile, { [cls.speaking]: participant.speaking, [cls.singleTile]: single })}
    >
      <Flex className={cls.frame} align="center" justify="center">
        {showVideo ? (
          <VideoSurface track={track} />
        ) : (
          <VStack align="center" gap="8" className={cls.fallback}>
            <Avatar name={participant.displayName} />
            <Text variant="small">
              {t('conferences.live.videoFailed', 'Видео не подключилось')}
            </Text>
            <Text variant="xs">
              {t('conferences.live.videoRetry', 'Повторить подключение видео')}
            </Text>
          </VStack>
        )}
      </Flex>
      <Text className={cls.caption} title={participant.displayName} variant="small">
        {participant.displayName}
      </Text>
    </Flex>
  );
}
