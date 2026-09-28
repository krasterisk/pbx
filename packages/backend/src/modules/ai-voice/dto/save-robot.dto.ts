import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsArray, MaxLength, ArrayMaxSize } from 'class-validator';
import type { AiVoiceRobotConfig } from '@krasterisk/shared';

export class SaveRobotDto implements AiVoiceRobotConfig {
  @IsString() @MaxLength(128) name!: string;
  @IsString() @MaxLength(64) uniqueId!: string;
  @IsBoolean() enabled!: boolean;
  @IsString() @MaxLength(100000) instruction!: string;
  @IsString() @MaxLength(10000) greeting!: string;
  @IsString() @MaxLength(10000) comment!: string;
  @IsIn(['realtime', 'cascade']) mode!: 'realtime' | 'cascade';
  @IsOptional() @IsInt() modelProfileId!: number | null;
  @IsOptional() @IsInt() sttProfileId!: number | null;
  @IsOptional() @IsInt() ttsProfileId!: number | null;
  @IsString() @MaxLength(256) model!: string;
  @IsString() @MaxLength(64) voice!: string;
  @IsString() @MaxLength(256) ttsVoice!: string;
  @IsNumber() temperature!: number;
  // Numeric-or-inf validation is performed by the shared domain validator.
  @IsOptional() maxResponseOutputTokens!: number | 'inf';
  @IsIn(['pcm16', 'g711_alaw', 'g711_ulaw']) inputAudioFormat!: AiVoiceRobotConfig['inputAudioFormat'];
  @IsIn(['pcm16', 'g711_alaw', 'g711_ulaw']) outputAudioFormat!: AiVoiceRobotConfig['outputAudioFormat'];
  @IsString() @MaxLength(256) inputTranscriptionModel!: string;
  @IsString() @MaxLength(32) inputTranscriptionLanguage!: string;
  @IsString() @MaxLength(256) outputTranscriptionModel!: string;
  @IsIn(['none', 'near_field', 'far_field']) noiseReduction!: AiVoiceRobotConfig['noiseReduction'];
  @IsIn(['server_vad', 'none']) turnDetection!: AiVoiceRobotConfig['turnDetection'];
  @IsNumber() vadThreshold!: number;
  @IsInt() prefixPaddingMs!: number;
  @IsInt() silenceDurationMs!: number;
  @IsInt() idleTimeoutMs!: number;
  @IsString() @MaxLength(32) semanticEagerness!: string;
  @IsBoolean() interruptResponse!: boolean;
  @IsBoolean() analytic!: boolean;
  @IsBoolean() allowHangup!: boolean;
  @IsBoolean() allowTransfer!: boolean;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) transferTargets!: string[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) toolIds!: string[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) mcpServerIds!: string[];
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) knowledgeBaseIds!: string[];
  @IsInt() maxCallMs!: number;
}
