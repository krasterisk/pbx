import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export class IntegrationListQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID() cursor?: string;
}

export class CreateIntegrationBody {
  @ApiProperty({ maxLength: 120 })
  @IsString() @MinLength(1) @MaxLength(120) label!: string;

  @ApiProperty({ enum: ['speech_analytics', 'ai_voice_robots', 'pbx_support'] })
  @IsIn(['speech_analytics', 'ai_voice_robots', 'pbx_support']) product!: 'speech_analytics' | 'ai_voice_robots' | 'pbx_support';

  @ApiProperty({ format: 'uuid' })
  @IsUUID() operationId!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional() @IsISO8601({ strict: true }) expiresAt?: string | null;
}

export class IntegrationGrantBody {
  @ApiProperty({ enum: ['project', 'deployment', 'pbx'] })
  @IsIn(['project', 'deployment', 'pbx']) resourceKind!: 'project' | 'deployment' | 'pbx';

  @ApiProperty({ format: 'uuid' })
  @IsUUID() resourceId!: string;

  @ApiProperty() @IsString() @MaxLength(64) scope!: string;
}

export class ReplaceIntegrationGrantsBody {
  @ApiProperty() @IsString() expectedRevision!: string;

  @ApiProperty({ type: [IntegrationGrantBody], maxItems: 100 })
  @IsArray() @ValidateNested({ each: true }) @Type(() => IntegrationGrantBody)
  grants!: IntegrationGrantBody[];
}

export class RotateIntegrationBody {
  @ApiProperty({ format: 'uuid' }) @IsUUID() operationId!: string;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedGeneration!: number;
}
