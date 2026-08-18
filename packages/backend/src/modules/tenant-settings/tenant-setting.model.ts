import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement } from 'sequelize-typescript';

/**
 * Per-tenant settings (D-19). Uniqueness is composite (vpbx_user_uid, key) —
 * `key` is NOT unique on its own (that would make the setting global).
 */
@Table({ tableName: 'tenant_settings', timestamps: false, freezeTableName: true })
export class TenantSetting extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column({ type: DataType.INTEGER })
  declare id: number;

  @Column({ field: 'vpbx_user_uid', type: DataType.INTEGER, allowNull: false })
  declare vpbxUserUid: number;

  @Column({ type: DataType.STRING(128), allowNull: false })
  declare key: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare value: string | null;

  @Column({ type: DataType.STRING(64), defaultValue: 'general' })
  declare category: string;
}
