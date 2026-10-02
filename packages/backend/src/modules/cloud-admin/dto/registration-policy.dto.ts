import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateRegistrationPolicyDto {
  @ApiProperty({ description: 'Allow public organization signup' })
  @IsBoolean()
  registrationEnabled!: boolean;
}
