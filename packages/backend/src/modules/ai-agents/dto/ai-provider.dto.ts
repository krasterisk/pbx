import {
  IsString, IsOptional, IsEnum, IsBoolean, IsObject, IsArray,
  MaxLength,
} from 'class-validator';

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

  @IsArray()
  @IsString({ each: true })
  capabilities: string[];

  @IsOptional()
  @IsObject()
  defaults?: Record<string, any>;

  @IsObject()
  pricing: Record<string, any>;

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
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsObject()
  defaults?: Record<string, any>;

  @IsOptional()
  @IsObject()
  pricing?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
