import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CallsQueryDto } from './calls-query.dto';
export class CallTextSearchDto extends CallsQueryDto {
  @IsString() @MinLength(2) @MaxLength(200) phrase!: string;
  @IsOptional() @IsIn(['literal','semantic']) mode?:'literal'|'semantic';
}
