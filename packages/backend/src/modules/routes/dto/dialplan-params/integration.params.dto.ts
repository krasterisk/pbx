import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type {
  INotifyActionParams,
  NotificationChannel,
} from '@krasterisk/shared';

const SAFE_TEXT = /^[^\n\r;]*$/;
const NOTIFY_CHANNELS: NotificationChannel[] = [
  'telegram',
  'email',
  'whatsapp',
  'webhook',
  'max',
  'vk',
];
const TELEGRAM_CHAT = /^-?\d{3,}$/;

function hasChannels(obj: NotifyParamsDto): boolean {
  return Array.isArray(obj.channels) && obj.channels.length > 0;
}

@ValidatorConstraint({ name: 'notifyRecipientsByChannel', async: false })
class NotifyRecipientsByChannelConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as NotifyParamsDto;
    const channels = obj.channels ?? [];
    const recipients = obj.recipients ?? {};
    if (channels.includes('email')) {
      const email = recipients.email ?? obj.target;
      if (!email || typeof email !== 'string') return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    if (channels.includes('telegram')) {
      const chat = recipients.telegram ?? obj.target;
      if (!chat || typeof chat !== 'string') return false;
      return TELEGRAM_CHAT.test(chat);
    }
    return true;
  }

  defaultMessage(): string {
    return 'recipient does not match the selected channel';
  }
}

export class NotifyParamsDto implements INotifyActionParams {
  @ValidateIf((o: NotifyParamsDto) => !hasChannels(o))
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  integration_uid?: number;

  @ValidateIf((o: NotifyParamsDto) => !o.body)
  @IsString()
  @MinLength(1)
  @Matches(SAFE_TEXT)
  message?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  target?: string;

  @IsOptional()
  @IsString()
  preset?: string;

  @IsOptional()
  @IsArray()
  @IsIn(NOTIFY_CHANNELS, { each: true })
  @Validate(NotifyRecipientsByChannelConstraint)
  channels?: NotificationChannel[];

  @IsOptional()
  @IsObject()
  recipients?: Partial<Record<NotificationChannel, string>>;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  subject?: string;

  @ValidateIf((o: NotifyParamsDto) => !o.message)
  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  body?: string;
}
