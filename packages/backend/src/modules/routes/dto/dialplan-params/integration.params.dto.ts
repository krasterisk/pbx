import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type {
  ICollectInputParams,
  IHttpRequestParams,
  INotifyActionParams,
} from '@krasterisk/shared';
import { CONDITION_VAR_NAME_RE } from '@krasterisk/shared';
import { assertSafeHttpUrl } from '../../../../shared/utils/dialplan-http.util';

const SAFE_TEXT = /^[^\n\r;]*$/;

/**
 * The channel comes from the integration, so the step only carries the
 * integration, the text, and an optional recipient override.
 */
export class NotifyParamsDto implements INotifyActionParams {
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  integration_uid: number;

  @IsString()
  @MinLength(1)
  @Matches(SAFE_TEXT)
  body: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  target?: string;

  @IsOptional()
  @IsString()
  @Matches(SAFE_TEXT)
  subject?: string;
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
