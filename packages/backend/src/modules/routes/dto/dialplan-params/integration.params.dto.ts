import { IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type {
  INotifyActionParams,
  ISendMailParams,
  ISendMailPeerParams,
  ITelegramParams,
} from '@krasterisk/shared';

const SAFE_TEXT = /^[^\n\r;]*$/;

export class NotifyParamsDto implements INotifyActionParams {
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  integration_uid: number;

  @IsString()
  @MinLength(1)
  @Matches(SAFE_TEXT)
  message: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  target?: string;

  @IsOptional()
  @IsString()
  preset?: string;
}

export class SendMailParamsDto implements ISendMailParams {
  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  subject?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  text?: string;
}

export class SendMailPeerParamsDto implements ISendMailPeerParams {
  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  exten?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  text?: string;
}

export class TelegramParamsDto implements ITelegramParams {
  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  chat_id?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  text?: string;
}
