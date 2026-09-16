import { IsIn, IsString } from 'class-validator';

export class ConferenceInviteDto {
  @IsIn(['internal', 'external'])
  kind!: 'internal' | 'external';

  @IsString()
  target!: string;
}
