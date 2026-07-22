/**
 * DTO for the transfer directory endpoint (D-36). Kept in a separate file
 * from dto/callcenter.dto.ts to avoid a wave collision (same convention as
 * dto/callcenter-missed.dto.ts).
 */
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DirectoryQueryDto {
  /** Optional case-insensitive substring filter over extension/label/name. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;
}
