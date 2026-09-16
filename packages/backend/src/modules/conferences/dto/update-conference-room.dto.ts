import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { CONFERENCE_ROOM_NUMBER_PATTERN } from './create-conference-room.dto';

export class UpdateConferenceRoomDto {
  @IsOptional()
  @IsString()
  @Matches(CONFERENCE_ROOM_NUMBER_PATTERN)
  number?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @IsOptional()
  @IsIn(['permanent', 'ephemeral'])
  kind?: 'permanent' | 'ephemeral';

  @IsOptional()
  @IsIn(['token_name', 'token_name_pin', 'token_name_pin_moderator'])
  entry_strictness?: 'token_name' | 'token_name_pin' | 'token_name_pin_moderator';

  @IsOptional()
  @IsString()
  @Length(1, 32)
  pin?: string | null;

  @IsOptional()
  @IsBoolean()
  wait_marked?: boolean;

  @IsOptional()
  @IsBoolean()
  end_marked?: boolean;

  @IsOptional()
  @IsIn(['off', 'auto', 'button', 'both'])
  record_mode?: 'off' | 'auto' | 'button' | 'both';

  @IsOptional()
  @IsBoolean()
  notify_recording?: boolean;

  @IsOptional()
  @IsIn(['owner', 'moderator', 'anyone'])
  invite_external_scope?: 'owner' | 'moderator' | 'anyone';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  tariff_max_participants?: number | null;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  musiconhold?: string | null;

  @IsOptional()
  @IsBoolean()
  announce_join_leave?: boolean;
}
