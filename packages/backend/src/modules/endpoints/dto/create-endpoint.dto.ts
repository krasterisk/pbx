import { IsString, IsOptional, IsNumber, MinLength, MaxLength } from 'class-validator';

export class CreateEndpointDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  extension: string;

  @IsString()
  @MinLength(4)
  password: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsString()
  context: string;

  @IsOptional()
  @IsString()
  transport?: string;

  @IsOptional()
  @IsString()
  codecs?: string; // comma-separated: "ulaw,alaw,g722"

  @IsOptional()
  @IsString()
  natProfile?: string; // 'lan' | 'nat' | 'webrtc'

  // Advanced PBX Features
  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  namedCallGroup?: string;

  @IsOptional()
  @IsString()
  namedPickupGroup?: string;

  // Auto-Provisioning
  @IsOptional()
  provisionEnabled?: boolean;

  @IsOptional()
  @IsString()
  macAddress?: string;

  @IsOptional()
  @IsNumber()
  provisionTemplateId?: number;

  @IsOptional()
  @IsString()
  pvVars?: string;

  // Advanced fields (all optional)
  @IsOptional()
  advanced?: Record<string, any>;
}

export class BulkCreateEndpointDto {
  @IsString()
  extensionsPattern: string; // e.g. "101,106,110-120"

  @IsString()
  @MinLength(4)
  passwordPattern: string; // 'auto' or a fixed password

  @IsOptional()
  @IsString()
  displayNamePattern?: string; // "Ext {N}"

  @IsString()
  context: string;

  @IsOptional()
  @IsString()
  transport?: string;

  @IsOptional()
  @IsString()
  codecs?: string;

  @IsOptional()
  @IsString()
  natProfile?: string;
}
