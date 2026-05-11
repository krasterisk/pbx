import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsObject,
  MaxLength, IsInt, Min,
} from 'class-validator';

export class CreateAiAgentDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsString()
  @MaxLength(64)
  unique_id: string;

  @IsEnum(['realtime', 'cascade'])
  mode: 'realtime' | 'cascade';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  voice?: string;

  @IsOptional()
  @IsString()
  greeting?: string;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  model_profile_id?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stt_profile_id?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tts_profile_id?: number;

  @IsOptional()
  @IsObject()
  vad_config?: Record<string, any>;

  @IsOptional()
  @IsInt()
  @Min(0)
  toolset_id?: number;

  @IsOptional()
  @IsEnum(['local', 'pjsip'])
  channel_kind?: 'local' | 'pjsip';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAiAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  unique_id?: string;

  @IsOptional()
  @IsEnum(['realtime', 'cascade'])
  mode?: 'realtime' | 'cascade';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  voice?: string;

  @IsOptional()
  @IsString()
  greeting?: string;

  @IsOptional()
  @IsString()
  instruction?: string;

  @IsOptional()
  @IsInt()
  model_profile_id?: number;

  @IsOptional()
  @IsInt()
  stt_profile_id?: number;

  @IsOptional()
  @IsInt()
  tts_profile_id?: number;

  @IsOptional()
  @IsObject()
  vad_config?: Record<string, any>;

  @IsOptional()
  @IsInt()
  toolset_id?: number;

  @IsOptional()
  @IsEnum(['local', 'pjsip'])
  channel_kind?: 'local' | 'pjsip';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
