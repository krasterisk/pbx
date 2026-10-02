import {
  Table, Column, Model, DataType,
  PrimaryKey, AutoIncrement, AllowNull, Default,
} from 'sequelize-typescript';

/** Per-cabinet Hub order and visibility. Pages stay on the platform catalog. */
@Table({
  tableName: 'tenant_hub_layout',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['tenant_id', 'hub_code'], name: 'uq_tenant_hub_layout' },
  ],
})
export class TenantHubLayout extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare tenant_id: number;

  @AllowNull(false)
  @Column(DataType.STRING(64))
  declare hub_code: string;

  @Default(0)
  @Column(DataType.INTEGER)
  declare sort_order: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare visible: boolean;
}
