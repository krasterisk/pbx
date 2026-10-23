import { QueryTypes, type Sequelize } from 'sequelize';
import type { OrganizationWeekStart } from '@krasterisk/shared';
import { missingTimezoneTable } from './organization-timezone';

export const organizationWeekStartKey = (tenant: number) => `organization.weekStart.${tenant}`;
export async function readOrganizationWeekStart(db: Sequelize, tenant: number): Promise<OrganizationWeekStart> {
  try {
    const column = db.getDialect?.() === 'postgres' ? '"key"' : '`key`';
    const [row] = await db.query<{ value: string }>(`SELECT value FROM system_settings WHERE ${column}=:calendarKey LIMIT 1`, {
      replacements: { calendarKey: organizationWeekStartKey(tenant) }, type: QueryTypes.SELECT,
    });
    return row?.value === 'sunday' ? 'sunday' : 'monday';
  } catch (error) {
    if (!missingTimezoneTable(error)) throw error;
    return 'monday';
  }
}
