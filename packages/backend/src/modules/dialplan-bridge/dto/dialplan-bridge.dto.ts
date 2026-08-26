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

export class HttpRequestDialplanDto extends DialplanBridgeBaseDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  timeout?: string;

  @IsOptional()
  @IsString()
  route_uid?: string;

  @IsOptional()
  @IsString()
  action_id?: string;
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

  // Flattened IIvrPhraseTtsSettings — merged over the engine settings server-side.
  @IsOptional()
  @IsString()
  voice?: string;

  @IsOptional()
  @IsString()
  language_code?: string;

  @IsOptional()
  @IsString()
  speed?: string;

  @IsOptional()
  @IsString()
  speaking_rate?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  pitch_shift?: string;
}
