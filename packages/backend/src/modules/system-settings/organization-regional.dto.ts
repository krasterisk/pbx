import { IsIn } from 'class-validator';
import type { OrganizationWeekStart } from '@krasterisk/shared';
import { OrganizationTimezoneDto } from './organization-timezone.dto';

export class OrganizationRegionalDto extends OrganizationTimezoneDto {
  @IsIn(['monday', 'sunday'])
  weekStart: OrganizationWeekStart;
}
