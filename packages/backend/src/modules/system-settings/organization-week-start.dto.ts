import { IsIn } from 'class-validator';
import type { OrganizationWeekStart } from '@krasterisk/shared';
export class OrganizationWeekStartDto {
  @IsIn(['monday', 'sunday'])
  weekStart!: OrganizationWeekStart;
}
