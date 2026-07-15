import {
  IsString, IsOptional, IsObject, IsIn, MaxLength,
} from 'class-validator';

export const NOTIFICATION_CHANNELS = [
  'telegram', 'email', 'whatsapp', 'webhook', 'max', 'vk',
] as const;

export type NotificationChannelDto = typeof NOTIFICATION_CHANNELS[number];

export class CreateNotificationIntegrationDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsIn([...NOTIFICATION_CHANNELS])
  channel: NotificationChannelDto;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  /** Plaintext secret object on save only; service encrypts before persisting. */
  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;
}

export class UpdateNotificationIntegrationDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsIn([...NOTIFICATION_CHANNELS])
  channel?: NotificationChannelDto;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;
}
