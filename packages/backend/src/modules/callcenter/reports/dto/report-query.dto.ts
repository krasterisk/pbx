import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportQueryDto {
  @IsString()
  dateFrom!: string;

  @IsString()
  dateTo!: string;

  /** One queue, or several names separated by commas. */
  @IsOptional()
  @IsString()
  queueName?: string;

  @IsOptional()
  @IsString()
  agentInterface?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize?: number;
}

/** Export has its own query contract; global whitelist rejects undeclared keys. */
export class ExportReportQueryDto extends ReportQueryDto {
  @IsIn(['csv', 'xlsx', 'pdf'])
  format!: 'csv' | 'xlsx' | 'pdf';
}
