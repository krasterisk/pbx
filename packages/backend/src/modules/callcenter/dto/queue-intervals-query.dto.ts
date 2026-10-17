import { IsIn, IsInt, IsOptional, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Tenant-local calendar days (default: today); the tenant itself comes from the JWT, never from the query. */
export class QueueIntervalsQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_KEY, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([15, 30, 60])
  granularityMin?: number;

  @IsOptional()
  @IsString()
  queueName?: string;

  @IsOptional()
  @IsIn(['weekAgo'])
  compare?: 'weekAgo';
}
