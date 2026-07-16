import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class PurchaseModuleDto {
  @ApiProperty({ example: 'voice_robot', description: 'Catalog / Hub module code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z0-9_]+$/i, { message: 'moduleCode must be alphanumeric/underscore' })
  moduleCode!: string;
}
