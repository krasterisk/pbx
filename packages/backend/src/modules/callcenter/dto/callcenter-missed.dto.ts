/**
 * DTO for the smart missed-calls engine (D-16/D-18/D-19). Kept in a
 * separate file from dto/callcenter.dto.ts to avoid a wave collision
 * (same convention as dto/callcenter-callcontrol.dto.ts).
 */
import { IsString, MaxLength } from 'class-validator';

export class MissedCallActionDto {
  /** Caller number identifying the missed-call number-group to claim/callback */
  @IsString()
  @MaxLength(64)
  callerIdNum: string;
}
