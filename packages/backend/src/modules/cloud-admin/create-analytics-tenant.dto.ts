import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Trusted platform action; profile and module set are server-owned constants. */
export class CreateAnalyticsTenantBody {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(255)
  name!: string;

  @ApiProperty() @IsEmail() @MaxLength(255)
  email!: string;

  @ApiProperty({ minLength: 8 }) @IsString() @MinLength(8) @MaxLength(128)
  password!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  adminName?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional() @IsInt() @Min(1) @Max(365)
  trialDays?: number;
}
