import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';

export class PromptTtsUpdateDto {
  @IsString()
  @MaxLength(5000)
  text: string;

  @IsInt()
  @Min(1)
  engine_uid: number;

  @IsOptional()
  @IsObject()
  settings?: IIvrPhraseTtsSettings;
}

export class PromptUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PromptTtsUpdateDto)
  tts?: PromptTtsUpdateDto;
}
