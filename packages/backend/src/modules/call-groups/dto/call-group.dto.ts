import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsArray,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 2–8 digits — same envelope as queue/internal numbers (T-12-14-02) */
export const CALL_GROUP_EXTEN_PATTERN = /^\d{2,8}$/;

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

  @IsString()
  @Matches(CALL_GROUP_EXTEN_PATTERN, { message: 'exten must be 2-8 digits' })
  exten: string;

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
  @IsString()
  @Matches(CALL_GROUP_EXTEN_PATTERN, { message: 'exten must be 2-8 digits' })
  exten?: string;

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
