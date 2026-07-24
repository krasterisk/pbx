import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Shared tenant contact book for softphone Contacts "Книга" (Phase 10 D-11…D-15).
 * Separate from Phase 5 route_phonebooks (no name / ownership columns there).
 */
@Table({ tableName: 'cc_contacts', updatedAt: 'updated_at', createdAt: 'created_at' })
export class CcContact extends Model {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.BIGINT })
  declare uid: number;

  /** Tenant isolation (maps to DB column vpbx_user_uid). */
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'vpbx_user_uid' })
  declare user_uid: number;

  /** Operator user id who created the row (D-13 ownership). */
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare created_by: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare name: string;

  @Column({ type: DataType.STRING(64), allowNull: false })
  declare number: string;

  @Column({ type: DataType.STRING(255), allowNull: true, defaultValue: null })
  declare note: string | null;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare created_at: Date;

  @Column({ type: DataType.DATE, allowNull: false, defaultValue: DataType.NOW })
  declare updated_at: Date;
}
