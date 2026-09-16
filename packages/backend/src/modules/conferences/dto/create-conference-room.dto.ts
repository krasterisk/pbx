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

export const CONFERENCE_ROOM_NUMBER_PATTERN = /^\d{1,32}$/;
export const CONFERENCE_PIN_PATTERN = /^\d{4,32}$/;

export class CreateConferenceRoomDto {
  @IsString()
  @Matches(CONFERENCE_ROOM_NUMBER_PATTERN)
  number!: string;

  @IsString()
  @Length(1, 255)
  name!: string;

  @IsOptional()
  @IsIn(['permanent', 'ephemeral'])
  kind?: 'permanent' | 'ephemeral';

  @IsOptional()
  @IsIn(['token_name', 'token_name_pin', 'token_name_pin_moderator'])
  entry_strictness?: 'token_name' | 'token_name_pin' | 'token_name_pin_moderator';

  @IsOptional()
  @IsString()
  @Matches(CONFERENCE_PIN_PATTERN)
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
