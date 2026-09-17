import { useTranslation } from 'react-i18next';
import { MicOff, VideoOff } from 'lucide-react';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge, Button } from '@/shared/ui';
import { Text } from '@/shared/ui/Text/Text';
import { Flex, HStack, VStack } from '@/shared/ui/Stack';
import { VideoSurface } from '@/shared/ui/VideoSurface';
import { classNames } from '@/shared/lib/classNames/classNames';
import type { LiveRoomParticipant } from './LiveRoom';
import cls from './ParticipantTile.module.scss';

export interface ParticipantTileProps {
  mid: string;
  participant: LiveRoomParticipant;
  track?: MediaStreamTrack;
  single?: boolean;
  videoFailed?: boolean;
  onRetry?: () => void;
}

export function ParticipantTile({
  mid,
  participant,
  track,
  single,
  videoFailed = false,
  onRetry,
}: ParticipantTileProps) {
  const { t } = useTranslation();
  const retryLabel = t('conferences.live.videoRetry', 'Повторить подключение видео');
  const showVideo = Boolean(track?.kind === 'video') && !videoFailed;
  const roleLabel =
    participant.role === 'owner'
      ? t('conferences.live.roleOwner', 'Владелец')
      : participant.role === 'moderator'
        ? t('conferences.live.roleModerator', 'Модератор')
        : null;

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
        ) : videoFailed ? (
          <VStack align="center" gap="8" className={cls.fallback}>
            <Avatar name={participant.displayName} />
            <Text variant="small">
              {t('conferences.live.videoFailed', 'Видео не подключилось')}
            </Text>
            {onRetry ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onRetry}
                style={{ minWidth: 44, minHeight: 44 }}
              >
                {retryLabel}
              </Button>
            ) : (
              <Text variant="xs">{retryLabel}</Text>
            )}
          </VStack>
        ) : (
          <Avatar name={participant.displayName} />
        )}
        <HStack className={cls.overlay} gap="4" align="center">
          {participant.muted ? <MicOff size={14} aria-hidden className={cls.stateIcon} /> : null}
          {!participant.video && !showVideo ? (
            <VideoOff size={14} aria-hidden className={cls.stateIcon} />
          ) : null}
          {roleLabel ? <Badge variant="secondary">{roleLabel}</Badge> : null}
        </HStack>
      </Flex>
      <Text className={cls.caption} title={participant.displayName} variant="small">
        {participant.displayName}
      </Text>
    </Flex>
  );
}
