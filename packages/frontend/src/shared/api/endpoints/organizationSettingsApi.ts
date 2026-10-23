import { rtkApi } from '../rtkApi';
import type { OrganizationCalendar, OrganizationWeekStart, OrganizationRegionalSettings } from '@krasterisk/shared';
export const organizationSettingsApi = rtkApi.injectEndpoints({
 overrideExisting: import.meta.hot != null,
 endpoints: build => ({
  getOrganizationRegional: build.query<OrganizationRegionalSettings,void>({query:()=>'/system-settings/organization-regional',providesTags:['OrganizationCalendar','CDR']}),
  setOrganizationRegional: build.mutation<OrganizationRegionalSettings,Pick<OrganizationRegionalSettings,'timezone'|'weekStart'>>({query:body=>({url:'/system-settings/organization-regional',method:'PUT',body}),invalidatesTags:['OrganizationCalendar','CDR']}),
  getOrganizationCalendar: build.query<OrganizationCalendar,void>({query:()=>'/system-settings/organization-calendar',providesTags:['OrganizationCalendar']}),
  setOrganizationWeekStart: build.mutation<OrganizationCalendar,{weekStart:OrganizationWeekStart}>({query:body=>({url:'/system-settings/organization-week-start',method:'PUT',body}),invalidatesTags:['OrganizationCalendar']}),
  getOrganizationTimezone: build.query<{timezone:string;canEdit:boolean},void>({query:()=>'/system-settings/organization-timezone',providesTags:['CDR']}),
  setOrganizationTimezone: build.mutation<{timezone:string;canEdit:boolean},{timezone:string}>({query:body=>({url:'/system-settings/organization-timezone',method:'PUT',body}),invalidatesTags:['CDR']}),
 }),
});
export const {useGetOrganizationRegionalQuery,useSetOrganizationRegionalMutation,useGetOrganizationTimezoneQuery,useSetOrganizationTimezoneMutation,useGetOrganizationCalendarQuery,useSetOrganizationWeekStartMutation}=organizationSettingsApi;
