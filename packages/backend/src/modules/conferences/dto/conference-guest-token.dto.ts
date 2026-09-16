import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateConferenceGuestTokenDto {
  @IsIn(['shared_link', 'named_invite'])
  kind!: 'shared_link' | 'named_invite';

  @ValidateIf((o: CreateConferenceGuestTokenDto) => o.kind === 'named_invite')
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  inviteName?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  ttlSec?: number;
}
