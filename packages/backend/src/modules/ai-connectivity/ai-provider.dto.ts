import {
  IsString, IsOptional, IsEnum, IsBoolean, IsObject, IsArray,
  MaxLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AuthHeaderDto {
  @IsString()
  @MaxLength(128)
  key: string;

  @IsString()
  @MaxLength(4096)
  value: string;
}
export class CreateAiProviderDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsEnum(['online', 'local', 'custom'])
  kind: 'online' | 'local' | 'custom';

  @IsString()
  @MaxLength(32)
  vendor: string;

  @IsString()
  @MaxLength(512)
  endpoint: string;

  @IsOptional()
  @IsEnum(['bearer', 'api_key_header', 'none', 'custom'])
  auth_type?: 'bearer' | 'api_key_header' | 'none' | 'custom';

  /** Plain text on input; the service encrypts before persisting. */
  @IsOptional()
  @IsString()
  apiKey?: string;

  /** Custom mode: header name plus secret. A blank value keeps the stored secret. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuthHeaderDto)
  authHeaders?: AuthHeaderDto[];

  @IsArray()
  @IsString({ each: true })
  capabilities: string[];

  @IsOptional()
  @IsObject()
  defaults?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAiProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsEnum(['online', 'local', 'custom'])
  kind?: 'online' | 'local' | 'custom';

  @IsOptional()
  @IsString()
  @MaxLength(32)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  endpoint?: string;

  @IsOptional()
  @IsEnum(['bearer', 'api_key_header', 'none', 'custom'])
  auth_type?: 'bearer' | 'api_key_header' | 'none' | 'custom';

  /** Plain text; if provided, replaces encrypted_api_key. */
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AuthHeaderDto)
  authHeaders?: AuthHeaderDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsObject()
  defaults?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
