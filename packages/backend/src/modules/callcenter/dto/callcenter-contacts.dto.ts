/**
 * DTOs for softphone shared contact book (Phase 10 D-11…D-15)
 * and SIP-mode DTMF (D-32) — kept here to avoid wave collisions with dto/callcenter.dto.ts.
 */
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** SIP-mode in-call DTMF (D-32). Digit must be a single AMI-safe character. */
export class SendDtmfDto {
  @IsString()
  @MaxLength(64)
  uniqueid: string;

  @IsString()
  @Matches(/^[0-9*#A-D]$/)
  digit: string;
}

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
