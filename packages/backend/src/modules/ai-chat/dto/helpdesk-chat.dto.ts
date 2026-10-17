import { IsInt, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';

/** Identity and destination are always injected by the authenticated backend. */
export class HelpdeskMessageDto {
  @IsUUID()
  requestId!: string;

  @IsString()
  @MaxLength(8000)
  message!: string;

  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  expectedTaskId!: string | null;

  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  expectedVersion!: number | null;
}
