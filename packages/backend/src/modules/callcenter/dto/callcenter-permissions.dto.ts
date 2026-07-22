/**
 * DTOs for granular-permissions / peer ChanSpy endpoints (D-21…D-25, D-38/D-39).
 * Kept in a separate file from dto/callcenter.dto.ts to avoid a wave-2 collision
 * with 09-03's edits to that file.
 */
import { IsEnum, IsString, MaxLength } from 'class-validator';

export class PeerSpyDto {
  /** Target agent SIP interface, e.g. "PJSIP/e101_42" */
  @IsString()
  @MaxLength(64)
  targetInterface: string;

  /** D-22: listen is MVP baseline; whisper/barge require the requester's spy_modes right. */
  @IsEnum(['listen', 'whisper', 'barge'])
  mode: 'listen' | 'whisper' | 'barge';
}
