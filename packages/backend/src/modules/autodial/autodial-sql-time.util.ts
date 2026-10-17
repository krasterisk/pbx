import type { Sequelize } from 'sequelize-typescript';

/** Sequelize v6 replacements serialize Date in the host TZ, ignoring options.timezone.
 * Pass explicit strings matching MySQL DATETIME storage; PostgreSQL gets an ISO instant. */
export function autodialSqlDate(date: Date, db: Pick<Sequelize, 'getDialect' | 'options'>): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid SQL timestamp');
  if (db.getDialect() === 'postgres') return date.toISOString();
  const timezone = db.options?.timezone ?? '+00:00';
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(timezone);
  if (!match) throw new Error('Autodial requires an explicit fixed DB timezone');
  const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '-' ? -1 : 1);
  return new Date(date.getTime() + minutes * 60000).toISOString().slice(0, 23).replace('T', ' ');
}
