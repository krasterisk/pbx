import { QueryTypes, type Sequelize } from 'sequelize';

export const organizationTimezoneKey = (tenant: number) => `organization.timezone.${tenant}`;
export function missingTimezoneTable(error: unknown): boolean {
  const value = error as { original?: { code?: string }; parent?: { code?: string } };
  return ['ER_NO_SUCH_TABLE', '42P01'].includes(value.original?.code || value.parent?.code || '');
}
export function validOrganizationTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; }
}
/** Cloud configuration, box organization fallback, then installation default. */
export async function readOrganizationTimezone(db: Sequelize, tenant: number, fallback: string): Promise<string> {
  try {
    const rows = await db.query<{ timezone: string }>('SELECT timezone FROM tenants WHERE vpbx_user_uid=:tenant LIMIT 1', { replacements: { tenant }, type: QueryTypes.SELECT });
    if (validOrganizationTimezone(rows[0]?.timezone)) return rows[0].timezone;
  } catch (error) { if (!missingTimezoneTable(error)) throw error; }
  try {
    const column = db.getDialect?.() === 'postgres' ? '"key"' : '`key`';
    const rows = await db.query<{ value: string }>(`SELECT value FROM system_settings WHERE ${column}=:timezoneKey LIMIT 1`, { replacements: { timezoneKey: organizationTimezoneKey(tenant) }, type: QueryTypes.SELECT });
    if (validOrganizationTimezone(rows[0]?.value)) return rows[0].value;
  } catch (error) { if (!missingTimezoneTable(error)) throw error; }
  return validOrganizationTimezone(fallback) ? fallback : 'UTC';
}
