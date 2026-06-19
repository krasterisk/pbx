import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';

export class PromptTtsPreviewDto {
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

export class PromptSynthesizeDto extends PromptTtsPreviewDto {
  @IsString()
  @MaxLength(255)
  comment: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  description?: string;
}
