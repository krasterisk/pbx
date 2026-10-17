import { IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import type { CcDashboardPreset } from '@krasterisk/shared';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === '1' || value === true) return true;
  if (value === 'false' || value === '0' || value === false) return false;
  return value;
};

/** Query of `GET /callcenter/dashboard/overview`. The tenant comes from the JWT, never from here. */
export class DashboardOverviewQueryDto {
  @IsOptional()
  @IsIn(['today', 'yesterday', '7d', '30d', 'custom'])
  period?: CcDashboardPreset;

  /** Tenant-local `YYYY-MM-DD`, only for `period=custom`. */
  @IsOptional()
  @IsString()
  @Matches(DATE_KEY, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_KEY, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  /** Compare with the previous period (default: on). */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  compare?: boolean;

  /** Comma-separated queue names; empty = all queues. */
  @IsOptional()
  @IsString()
  queues?: string;
}
