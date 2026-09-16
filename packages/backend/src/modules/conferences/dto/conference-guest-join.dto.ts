import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { DISPLAY_NAME_MAX_LENGTH } from './conference-participant.dto';
import { CONFERENCE_PIN_PATTERN } from './create-conference-room.dto';

export class ConferenceGuestJoinDto {
  @IsOptional()
  @IsString()
  @Length(1, DISPLAY_NAME_MAX_LENGTH)
  displayName?: string;

  @IsOptional()
  @Matches(CONFERENCE_PIN_PATTERN)
  pin?: string;
}
