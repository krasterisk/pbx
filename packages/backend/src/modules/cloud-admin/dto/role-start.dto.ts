import { IsArray, IsInt, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RoleStartRowDto {
  @IsInt()
  user_level: number;

  @IsString()
  @MaxLength(255)
  start_path: string;
}

export class UpsertRoleStartDefaultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleStartRowDto)
  rows: RoleStartRowDto[];
}

export class UpsertTenantRoleStartDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleStartRowDto)
  rows: RoleStartRowDto[];
}
