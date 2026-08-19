import { IsOptional, IsString } from 'class-validator';

export class DialplanBridgeBaseDto {
  @IsOptional()
  @IsString()
  api_key?: string;

  @IsOptional()
  @IsString()
  vpbx_user_uid?: string;

  @IsOptional()
  @IsString()
  clid?: string;

  @IsOptional()
  @IsString()
  exten?: string;

  @IsOptional()
  @IsString()
  uniqueid?: string;
}

export class SetclidDialplanDto extends DialplanBridgeBaseDto {
  @IsOptional()
  @IsString()
  list_uid?: string;

  @IsOptional()
  @IsString()
  clidnum?: string;
}

export class WebhookDialplanDto extends DialplanBridgeBaseDto {
  @IsOptional()
  @IsString()
  url?: string;
}

export class SendmailPeerDialplanDto extends DialplanBridgeBaseDto {
  @IsOptional()
  @IsString()
  text?: string;
}

export class TelegramDialplanDto extends DialplanBridgeBaseDto {
  @IsOptional()
  @IsString()
  chat_id?: string;

  @IsOptional()
  @IsString()
  text?: string;
}

export class TtsDialplanDto extends DialplanBridgeBaseDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  engine?: string;

  @IsOptional()
  @IsString()
  voice?: string;

  @IsOptional()
  @IsString()
  language?: string;
}
