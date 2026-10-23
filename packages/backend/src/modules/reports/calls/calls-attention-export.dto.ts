import { IsIn, IsOptional } from 'class-validator';
import { CallsQueryDto } from './calls-query.dto';
export class CallsAttentionExportDto extends CallsQueryDto {
  @IsOptional() @IsIn(['csv','xlsx']) format?: 'csv' | 'xlsx';
}
