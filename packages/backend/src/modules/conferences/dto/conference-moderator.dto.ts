import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { CONFERENCE_ROOM_NUMBER_PATTERN } from './create-conference-room.dto';

export class ConferenceModeratorDto {
  @IsString()
  @Matches(CONFERENCE_ROOM_NUMBER_PATTERN)
  endpointRef!: string;

  @IsIn(['owner', 'moderator'])
  role!: 'owner' | 'moderator';
}

export class SetConferenceModeratorsDto {
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => ConferenceModeratorDto)
  moderators!: ConferenceModeratorDto[];
}
