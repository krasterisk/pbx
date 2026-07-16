import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, AllowNull, Unique,
} from 'sequelize-typescript';

/** Platform-global role→start defaults (D-04 / D-16). */
@Table({
  tableName: 'role_start_defaults',
  timestamps: false,
})
export class RoleStartDefault extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Unique
  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare user_level: number;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare start_path: string;
}

/** Per-tenant role→start overrides (D-04). */
@Table({
  tableName: 'tenant_role_start',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['tenant_id', 'user_level'], name: 'uq_tenant_role_start' },
  ],
})
export class TenantRoleStart extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare tenant_id: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare user_level: number;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  declare start_path: string;
}
