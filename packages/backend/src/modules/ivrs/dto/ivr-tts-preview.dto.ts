import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';

export class IvrTtsPreviewDto {
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
