import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportQueryDto {
  @IsString()
  dateFrom!: string;

  @IsString()
  dateTo!: string;

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
