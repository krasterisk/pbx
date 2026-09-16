import { IsOptional, IsString, Matches } from 'class-validator';
import { CONFERENCE_PIN_PATTERN } from './create-conference-room.dto';

export class ConferenceGuestJoinDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @Matches(CONFERENCE_PIN_PATTERN)
  pin?: string;
}
