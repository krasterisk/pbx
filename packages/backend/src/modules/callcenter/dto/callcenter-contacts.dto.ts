/**
 * DTOs for softphone shared contact book (Phase 10 D-11…D-15).
 * Separate file to avoid wave collisions with dto/callcenter.dto.ts.
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MaxLength(128)
  name: string;

  @IsString()
  @MaxLength(64)
  number: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
