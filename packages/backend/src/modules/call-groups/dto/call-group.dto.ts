import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CallGroupMemberDto {
  @IsIn(['internal', 'external'])
  member_type: 'internal' | 'external';

  @IsString()
  value: string;

  @IsNumber()
  position: number;

  @IsOptional()
  @IsNumber()
  ring_time?: number;
}

export class CreateCallGroupDto {
  @IsString()
  name: string;

  @IsIn(['ringall', 'hunt', 'memoryhunt', 'random'])
  strategy: 'ringall' | 'hunt' | 'memoryhunt' | 'random';

  @IsOptional()
  @IsNumber()
  ring_time?: number;

  @IsOptional()
  @IsString()
  external_context?: string;

  @IsOptional()
  @IsString()
  cid_prefix?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallGroupMemberDto)
  members?: CallGroupMemberDto[];
}

export class UpdateCallGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['ringall', 'hunt', 'memoryhunt', 'random'])
  strategy?: 'ringall' | 'hunt' | 'memoryhunt' | 'random';

  @IsOptional()
  @IsNumber()
  ring_time?: number;

  @IsOptional()
  @IsString()
  external_context?: string;

  @IsOptional()
  @IsString()
  cid_prefix?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CallGroupMemberDto)
  members?: CallGroupMemberDto[];
}
