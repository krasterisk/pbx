import { Flex } from '@/shared/ui/Stack';
import { ParticipantTile } from './ParticipantTile';
import type { LiveRoomParticipant } from './LiveRoom';
import cls from './VideoGrid.module.scss';

export interface VideoGridProps {
  participants: LiveRoomParticipant[];
  remoteTracks: Record<string, MediaStreamTrack>;
  localStream?: MediaStream | null;
  selfName?: string;
  videoFailedMids?: string[];
  onRetry?: () => void;
}

function isSelfTile(
  participant: LiveRoomParticipant,
  participants: LiveRoomParticipant[],
  selfName?: string,
): boolean {
  if (participant.ref === 'local') return true;
  if (selfName && participant.displayName === selfName) return true;
  return participants.length === 1;
}

export function VideoGrid({
  participants,
  remoteTracks,
  localStream,
  selfName,
  videoFailedMids = [],
  onRetry,
}: VideoGridProps) {
  const mids = Object.keys(remoteTracks);
  const single = participants.length === 1;
  const localVideo = localStream?.getVideoTracks().find((track) => track.readyState === 'live');

  return (
    <Flex role="list" className={cls.grid} align="stretch" data-testid="conference-video-grid">
      {participants.map((participant, index) => {
        const mid = mids[index] ?? participant.ref;
        const self = Boolean(localVideo) && isSelfTile(participant, participants, selfName);
        return (
          <ParticipantTile
            key={mid}
            mid={self ? 'local' : mid}
            participant={participant}
            track={self ? localVideo : remoteTracks[mid]}
            single={single}
            videoFailed={!self && videoFailedMids.includes(mid)}
            onRetry={onRetry}
          />
        );
      })}
    </Flex>
  );
}
