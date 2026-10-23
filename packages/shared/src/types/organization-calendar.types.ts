export type OrganizationWeekStart = 'monday' | 'sunday';
export interface OrganizationCalendar {
  weekStart: OrganizationWeekStart;
  canEdit: boolean;
}

export interface OrganizationRegionalSettings extends OrganizationCalendar {
  timezone: string;
}
