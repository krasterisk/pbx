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
  ICollectInputParams,
  IHttpRequestParams,
  INotifyActionParams,
  NotificationChannel,
} from '@krasterisk/shared';
import { CONDITION_VAR_NAME_RE } from '@krasterisk/shared';
import { assertSafeHttpUrl } from '../../../../shared/utils/dialplan-http.util';

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

const ALLOWED_HTTP_HEADERS = ['Accept', 'Content-Type', 'Authorization', 'X-Request-Id'];

@ValidatorConstraint({ name: 'isSafeHttpUrl', async: false })
class IsSafeHttpUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !value) return false;
    try {
      assertSafeHttpUrl(value);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'url must be https and must not target a private, loopback, or metadata address';
  }
}

@ValidatorConstraint({ name: 'isAllowedHttpHeaders', async: false })
class IsAllowedHttpHeadersConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null) return true;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.keys(value).every((key) => ALLOWED_HTTP_HEADERS.includes(key));
  }

  defaultMessage(): string {
    return 'headers keys must be from the allowed set';
  }
}

export class HttpRequestParamsDto implements IHttpRequestParams {
  @IsString()
  @MinLength(1)
  @Validate(IsSafeHttpUrlConstraint)
  url: string;

  @IsIn(['GET', 'POST'])
  method: 'GET' | 'POST';

  @IsInt()
  @Min(1)
  timeout: number;

  @IsOptional()
  @IsObject()
  @Validate(IsAllowedHttpHeadersConstraint)
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  body?: string;
}

export class CollectInputParamsDto implements ICollectInputParams {
  @IsString()
  @Matches(CONDITION_VAR_NAME_RE)
  variableName: string;

  @IsInt()
  @Min(1)
  digitsCount: number;

  @IsInt()
  @Min(1)
  timeout: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_/-]+$/)
  promptFile?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  attempts?: number;

  @IsOptional()
  @IsIn(['digits', 'extension'])
  mode?: 'digits' | 'extension';
}
