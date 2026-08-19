import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class NotifyDialplanDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  integration_uid?: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  target?: string;

  @IsOptional()
  @IsString()
  clid?: string;

  @IsOptional()
  @IsString()
  exten?: string;

  @IsOptional()
  @IsString()
  uniqueid?: string;

  @IsOptional()
  @IsString()
  api_key?: string;

  @IsOptional()
  @IsString()
  channels?: string;

  @IsOptional()
  @IsString()
  recipients?: string;

  @IsOptional()
  @IsString()
  subject?: string;
}
