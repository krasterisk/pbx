import { IsString, MaxLength, IsTimeZone } from 'class-validator';

export class OrganizationTimezoneDto {
  @IsString() @MaxLength(64) @IsTimeZone()
  timezone!: string;
}
