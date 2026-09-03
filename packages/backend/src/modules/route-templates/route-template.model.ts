import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement,
  CreatedAt, UpdatedAt, AllowNull, Default,
} from 'sequelize-typescript';
import type { IRouteAction, ITemplateSlot } from '@krasterisk/shared';

@Table({
  tableName: 'route_templates',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true,
  indexes: [
    { name: 'idx_route_templates_vpbx_user_uid', fields: ['vpbx_user_uid'] },
    { name: 'uq_route_templates_tenant_name', unique: true, fields: ['vpbx_user_uid', 'name'] },
  ],
})
export class RouteTemplate extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare uid: number;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare name: string;

  @Default('')
  @Column({ type: DataType.STRING(512), allowNull: false })
  declare description: string;

  @Column({ type: DataType.JSON, allowNull: false })
  declare actions: IRouteAction[];

  @Column({ type: DataType.JSON, allowNull: false })
  declare slots: ITemplateSlot[];

  /** null = built-in catalog (D-33). */
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, defaultValue: null })
  declare vpbx_user_uid: number | null;

  @CreatedAt
  @Column(DataType.DATE)
  declare created_at: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updated_at: Date;
}
