import { IsString } from 'class-validator';

export class ConferenceDisplayNameDto {
  @IsString()
  displayName!: string;
}
