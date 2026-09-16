import { IsOptional, IsString, Length } from 'class-validator';
import { DISPLAY_NAME_MAX_LENGTH } from './conference-participant.dto';

export class ConferenceGuestJoinDto {
  @IsOptional()
  @IsString()
  @Length(1, DISPLAY_NAME_MAX_LENGTH)
  displayName?: string;
}
