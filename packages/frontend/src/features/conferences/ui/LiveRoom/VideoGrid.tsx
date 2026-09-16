import { Flex } from '@/shared/ui/Stack';
import { ParticipantTile } from './ParticipantTile';
import type { LiveRoomParticipant } from './LiveRoom';
import cls from './VideoGrid.module.scss';

export interface VideoGridProps {
  participants: LiveRoomParticipant[];
  remoteTracks: Record<string, MediaStreamTrack>;
  videoFailedMids?: string[];
  onRetry?: () => void;
}

export function VideoGrid({
  participants,
  remoteTracks,
  videoFailedMids = [],
  onRetry,
}: VideoGridProps) {
  const mids = Object.keys(remoteTracks);
  const single = participants.length === 1;

  return (
    <Flex role="list" className={cls.grid} align="stretch" data-testid="conference-video-grid">
      {participants.map((participant, index) => {
        const mid = mids[index] ?? participant.ref;
        return (
          <ParticipantTile
            key={mid}
            mid={mid}
            participant={participant}
            track={remoteTracks[mid]}
            single={single}
            videoFailed={videoFailedMids.includes(mid)}
            onRetry={onRetry}
          />
        );
      })}
    </Flex>
  );
}
